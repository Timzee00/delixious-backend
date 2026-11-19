import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { initializeTransaction } from '../utils/paystack.js';
import { calculateOrderAllocation } from '../utils/walletPricing.js';

const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  // Delivery dispatch and completion are controlled by the assigned rider.
  preparing: [],
  out_for_delivery: [],
  delivered: [],
  cancelled: [],
};

export async function checkout(req, res, next) {
  try {
    const { delivery_address, delivery_lat, delivery_lng } = req.body;

    const { data: carts, error: cartsError } = await supabaseAdmin
      .from('carts')
      .select('id, restaurant_id')
      .eq('user_id', req.user.id);
    if (cartsError) throw cartsError;
    if (!carts?.length) return res.status(400).json({ error: 'Your cart is empty.' });

    const { data: walletSettings, error: settingsError } = await supabaseAdmin
      .from('wallet_settings')
      .select('restaurant_commission_bps,rider_commission_bps,restaurant_delivery_fee_kobo')
      .eq('id', 1).single();
    if (settingsError) throw settingsError;
    const checkoutGroupId = uuidv4();
    const createdOrders = [];
    const splitSubaccounts = [];
    let grandTotalKobo = 0;

    for (const cart of carts) {
      const { data: cartItems, error: cartItemsError } = await supabaseAdmin
        .from('cart_items')
        .select('quantity, special_instructions, menu_items(id, name, price, is_available, restaurant_id)')
        .eq('cart_id', cart.id);
      if (cartItemsError) throw cartItemsError;
      if (!cartItems?.length) continue;

      const unavailable = cartItems.find((ci) =>
        !ci.menu_items || !ci.menu_items.is_available || ci.menu_items.restaurant_id !== cart.restaurant_id);
      if (unavailable) {
        return res.status(400).json({ error: `${unavailable.menu_items?.name || 'A cart item'} is no longer available. Please update your cart.` });
      }

      const { data: restaurant, error: restaurantError } = await supabaseAdmin
        .from('restaurants')
        .select('id, name, is_open, approval_status, paystack_subaccount_code')
        .eq('id', cart.restaurant_id)
        .single();
      if (restaurantError || !restaurant) return res.status(404).json({ error: 'Restaurant not found.' });
      if (!restaurant.is_open) return res.status(400).json({ error: `${restaurant.name} is currently closed.` });
      if (restaurant.approval_status !== 'approved') {
        return res.status(400).json({ error: `${restaurant.name} is not approved to receive orders yet.` });
      }
      if (!restaurant.paystack_subaccount_code) {
        return res.status(400).json({ error: `${restaurant.name} has not completed its payout setup and cannot accept paid orders yet.` });
      }

      const foodTotalKobo = cartItems.reduce((sum, ci) =>
        sum + Math.round(Number(ci.menu_items.price) * 100) * ci.quantity, 0);
      if (!Number.isSafeInteger(foodTotalKobo) || foodTotalKobo <= 0) {
        return res.status(400).json({ error: 'Invalid cart total. Please refresh your cart.' });
      }
      let allocation;
      try {
        allocation = calculateOrderAllocation(foodTotalKobo, walletSettings);
      } catch (allocationError) {
        return res.status(400).json({ error: allocationError.message });
      }
      const subtotal = foodTotalKobo / 100;
      const total_amount = subtotal;
      const platform_commission = allocation.platformGrossCommissionKobo / 100;
      const restaurantShareKobo = allocation.restaurantShareKobo;

      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: req.user.id,
          restaurant_id: restaurant.id,
          status: 'pending',
          subtotal,
          delivery_fee: 0,
          total_amount,
          platform_commission,
          rider_payout_amount: allocation.riderPayoutKobo / 100,
          restaurant_delivery_cost_kobo: allocation.deliveryCostKobo,
          restaurant_commission_bps: walletSettings.restaurant_commission_bps,
          rider_commission_bps: walletSettings.rider_commission_bps,
          rider_commission_kobo: allocation.riderCommissionKobo,
          restaurant_net_amount: restaurantShareKobo / 100,
          delivery_address,
          delivery_lat,
          delivery_lng,
          payment_status: 'pending',
          checkout_group_id: checkoutGroupId,
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

      const { error: trackingError } = await supabaseAdmin
        .from('delivery_tracking')
        .insert({ order_id: order.id, status: 'pending' });
      if (trackingError) throw trackingError;

      createdOrders.push(order);
      splitSubaccounts.push({ subaccount: restaurant.paystack_subaccount_code, shareKobo: restaurantShareKobo });
      grandTotalKobo += allocation.customerTotalKobo;
    }

    if (!createdOrders.length) return res.status(400).json({ error: 'Your cart is empty.' });

    const reference = `delixious_${uuidv4()}`;

    // Create the local payment record before calling the provider so every
    // initialized payment has a durable internal reference, even if the
    // provider call or a later database operation fails.
    const { error: paymentCreateError } = await supabaseAdmin.from('payments').insert({
      checkout_group_id: checkoutGroupId,
      provider: 'paystack',
      reference,
      amount: grandTotalKobo / 100,
      status: 'pending',
    });
    if (paymentCreateError) throw paymentCreateError;

    let paystackResponse;
    try {
      paystackResponse = await initializeTransaction({
        email: req.user.email,
        amountKobo: grandTotalKobo,
        reference,
        callback_url: `${process.env.FRONTEND_URL}/order-confirmation?checkout_group_id=${encodeURIComponent(checkoutGroupId)}&reference=${encodeURIComponent(reference)}`,
        metadata: { checkout_group_id: checkoutGroupId, user_id: req.user.id },
        splitSubaccounts,
      });
    } catch (paymentError) {
      await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('reference', reference);
      await supabaseAdmin.from('orders').delete().eq('checkout_group_id', checkoutGroupId).eq('payment_status', 'pending');
      throw paymentError;
    }

    if (!paystackResponse.status) {
      await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('reference', reference);
      await supabaseAdmin.from('orders').delete().eq('checkout_group_id', checkoutGroupId).eq('payment_status', 'pending');
      return res.status(502).json({ error: 'Could not initialize payment. Please try again.' });
    }

    const { error: orderReferenceError } = await supabaseAdmin
      .from('orders')
      .update({ payment_reference: reference })
      .eq('checkout_group_id', checkoutGroupId);
    if (orderReferenceError) {
      await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('reference', reference);
      await supabaseAdmin.from('orders').delete().eq('checkout_group_id', checkoutGroupId).eq('payment_status', 'pending');
      throw orderReferenceError;
    }

    // Payment initialization is NOT proof of payment. Retain the cart so
    // abandoned or unsuccessful Paystack checkouts can be retried.
    // Purchased items are removed only after a verified successful charge.

    res.status(201).json({
      message: 'Orders created. Redirect the customer to authorization_url to complete payment.',
      orders: createdOrders,
      checkout_group_id: checkoutGroupId,
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
    const { page, limit, statuses } = req.query;
    const from = (page - 1) * limit;
    let query = supabaseAdmin
      .from('orders')
      .select('*, restaurants(name, logo_url), order_items(*), reviews(id, rating, comment, created_at)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (statuses) query = query.in('status', statuses.split(','));
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ orders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function getOrderGroup(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, restaurants(id, name, logo_url, owner_id), order_items(*), delivery_tracking(*), reviews(id, rating, comment, created_at)')
      .eq('checkout_group_id', req.params.checkoutGroupId)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: 'Checkout group not found.' });

    res.json({ orders: data, checkout_group_id: req.params.checkoutGroupId });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req, res, next) {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, restaurants(id, name, logo_url, owner_id), order_items(*), delivery_tracking(*), reviews(id, rating, comment, created_at)')
      .eq('id', req.params.id)
      .single();
    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    const isCustomer = order.user_id === req.user.id;
    const isRestaurantOwner = order.restaurants?.owner_id === req.user.id;
    const isAdmin = req.profile.role === 'admin';
    if (!isCustomer && !isRestaurantOwner && !isAdmin) return res.status(403).json({ error: 'You do not have access to this order.' });
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data: order, error } = await supabaseAdmin.from('orders').select('*, restaurants(owner_id)').eq('id', req.params.id).single();
    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    const isRestaurantOwner = order.restaurants.owner_id === req.user.id;
    if (!isRestaurantOwner && req.profile.role !== 'admin') return res.status(403).json({ error: 'Only the restaurant owner can update order status.' });
    if (['confirmed', 'preparing', 'out_for_delivery', 'delivered'].includes(status) && order.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment must be confirmed before this order can progress.' });
    }
    const allowedNext = VALID_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) return res.status(400).json({ error: `Cannot move order from "${order.status}" to "${status}".` });
    if (status === 'cancelled' && (order.payment_status === 'paid' || order.payment_status === 'refunded' || order.payment_reference)) {
      return res.status(409).json({ error: 'A charged or in-progress payment requires support-assisted cancellation and refund handling.' });
    }

    let update = supabaseAdmin.from('orders')
      .update({ status })
      .eq('id', order.id)
      .eq('status', order.status)
      .eq('payment_status', order.payment_status);
    if (status === 'cancelled') update = update.is('payment_reference', null);
    const { data: updated, error: updateError } = await update.select().maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'Order changed during this request. Refresh and try again.' });
    await supabaseAdmin.from('notifications').insert({ user_id: order.user_id, title: 'Order update', body: `Your order is now "${status.replace(/_/g, ' ')}".`, type: 'order_update' });
    res.json({ message: 'Order status updated.', order: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', req.params.id).single();
    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    if (order.user_id !== req.user.id) return res.status(403).json({ error: 'You can only cancel your own orders.' });
    if (!['pending', 'confirmed'].includes(order.status)) return res.status(400).json({ error: `Order can no longer be cancelled (status: ${order.status}).` });
    // A paid order requires a confirmed refund workflow; simply toggling
    // status to "cancelled" would leave the customer charged.
    if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return res.status(409).json({ error: 'This order has a completed payment. Please contact support to request cancellation and a refund.' });
    }
    if (order.payment_status === 'pending' && order.payment_reference) {
      return res.status(409).json({ error: 'Payment authorization is in progress. Contact support before cancelling; your payment may still complete.' });
    }
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
      .eq('status', order.status)
      .in('payment_status', ['pending', 'failed'])
      // Do not race a newly-created Paystack checkout reference.
      .is('payment_reference', null)
      .select()
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'Order or payment status changed. Refresh the order before cancelling.' });
    res.json({ message: 'Unpaid order cancelled.', order: updated });
  } catch (err) {
    next(err);
  }
}

export async function listRestaurantOrders(req, res, next) {
  try {
    const { page, limit, statuses, paid_only } = req.query;
    const from = (page - 1) * limit;
    let query = supabaseAdmin
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .eq('restaurant_id', req.restaurant.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (statuses) query = query.in('status', statuses.split(','));
    if (paid_only === 'true') query = query.eq('payment_status', 'paid');
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ orders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}
