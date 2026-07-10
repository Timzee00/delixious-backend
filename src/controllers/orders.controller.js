import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { getUserActiveCart } from '../utils/cart.js';
import { initializeTransaction } from '../utils/paystack.js';

const DELIVERY_FEE = 500; // flat fee in Naira for now; can become distance-based later

const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

export async function checkout(req, res, next) {
  try {
    const { delivery_address, delivery_lat, delivery_lng } = req.body;

    const activeCart = await getUserActiveCart(req.user.id);
    if (!activeCart) return res.status(400).json({ error: 'Your cart is empty.' });

    const { data: cartItems, error: cartItemsError } = await supabaseAdmin
      .from('cart_items')
      .select('quantity, special_instructions, menu_items(id, name, price, is_available, restaurant_id)')
      .eq('cart_id', activeCart.id);

    if (cartItemsError) throw cartItemsError;
    if (!cartItems?.length) return res.status(400).json({ error: 'Your cart is empty.' });

    const unavailable = cartItems.find((ci) => !ci.menu_items.is_available);
    if (unavailable) {
      return res.status(400).json({
        error: `${unavailable.menu_items.name} is no longer available. Please update your cart.`,
      });
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, is_open')
      .eq('id', activeCart.restaurant_id)
      .single();

    if (restaurantError || !restaurant) return res.status(404).json({ error: 'Restaurant not found.' });
    if (!restaurant.is_open) return res.status(400).json({ error: `${restaurant.name} is currently closed.` });

    const subtotal = cartItems.reduce((sum, ci) => sum + Number(ci.menu_items.price) * ci.quantity, 0);
    const total_amount = subtotal + DELIVERY_FEE;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: req.user.id,
        restaurant_id: restaurant.id,
        status: 'pending',
        subtotal,
        delivery_fee: DELIVERY_FEE,
        total_amount,
        delivery_address,
        delivery_lat,
        delivery_lng,
        payment_status: 'pending',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItemsPayload = cartItems.map((ci) => ({
      order_id: order.id,
      menu_item_id: ci.menu_items.id,
      name_snapshot: ci.menu_items.name,
      price_snapshot: ci.menu_items.price,
      quantity: ci.quantity,
      subtotal: Number(ci.menu_items.price) * ci.quantity,
    }));

    const { error: orderItemsError } = await supabaseAdmin.from('order_items').insert(orderItemsPayload);
    if (orderItemsError) throw orderItemsError;

    // Cart has been converted into an order - clear it
    await supabaseAdmin.from('carts').delete().eq('id', activeCart.id);

    const reference = `delixious_${uuidv4()}`;
    const paystackResponse = await initializeTransaction({
      email: req.user.email,
      amountKobo: Math.round(total_amount * 100),
      reference,
      callback_url: `${process.env.FRONTEND_URL}/order-confirmation?order_id=${order.id}`,
      metadata: { order_id: order.id, user_id: req.user.id },
    });

    if (!paystackResponse.status) {
      return res.status(502).json({ error: 'Could not initialize payment. Please try again.' });
    }

    await supabaseAdmin.from('payments').insert({
      order_id: order.id,
      provider: 'paystack',
      reference,
      amount: total_amount,
      status: 'pending',
    });

    await supabaseAdmin.from('orders').update({ payment_reference: reference }).eq('id', order.id);

    res.status(201).json({
      message: 'Order created. Redirect the customer to authorization_url to complete payment.',
      order,
      payment: {
        reference,
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listMyOrders(req, res, next) {
  try {
    const { page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('orders')
      .select('*, restaurants(name, logo_url), order_items(*)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ orders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req, res, next) {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, restaurants(id, name, logo_url, owner_id), order_items(*), delivery_tracking(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found.' });

    const isCustomer = order.user_id === req.user.id;
    const isRestaurantOwner = order.restaurants?.owner_id === req.user.id;
    const isAdmin = req.profile.role === 'admin';

    if (!isCustomer && !isRestaurantOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, restaurants(owner_id)')
      .eq('id', req.params.id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found.' });

    const isRestaurantOwner = order.restaurants.owner_id === req.user.id;
    if (!isRestaurantOwner && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Only the restaurant owner can update order status.' });
    }

    const allowedNext = VALID_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({ error: `Cannot move order from "${order.status}" to "${status}".` });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) throw updateError;

    await supabaseAdmin.from('notifications').insert({
      user_id: order.user_id,
      title: 'Order update',
      body: `Your order is now "${status.replace(/_/g, ' ')}".`,
      type: 'order_update',
    });

    res.json({ message: 'Order status updated.', order: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    if (order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own orders.' });
    }
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ error: `Order can no longer be cancelled (status: ${order.status}).` });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) throw updateError;
    res.json({ message: 'Order cancelled.', order: updated });
  } catch (err) {
    next(err);
  }
}

// Used by restaurants.routes.js under /api/restaurants/:id/orders (owner dashboard)
export async function listRestaurantOrders(req, res, next) {
  try {
    const { page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .eq('restaurant_id', req.restaurant.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ orders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}
