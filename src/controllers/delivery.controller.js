import { supabaseAdmin } from '../config/supabase.js';

const AGENT_TRANSITIONS = {
  assigned: ['picked_up'],
  picked_up: ['en_route'],
  en_route: ['delivered'],
  delivered: [],
};

async function loadOrderWithRestaurant(orderId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, restaurants(owner_id)')
    .eq('id', orderId)
    .single();
  if (error || !data) return null;
  return data;
}

// Lets a restaurant owner look up a delivery agent by phone number before
// assigning them to an order - deliberately search-only (not a public list)
// since it exposes agent contact info.
export async function searchDeliveryAgents(req, res, next) {
  try {
    const { phone } = req.query;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'delivery_agent')
      .ilike('phone', `%${phone.trim()}%`)
      .limit(10);

    if (error) throw error;
    res.json({ agents: data });
  } catch (err) {
    next(err);
  }
}

export async function assignAgent(req, res, next) {
  try {
    const { delivery_agent_id } = req.body;

    const order = await loadOrderWithRestaurant(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const isRestaurantOwner = order.restaurants.owner_id === req.user.id;
    if (!isRestaurantOwner && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Only the restaurant owner can assign a delivery agent.' });
    }

    if (!['confirmed', 'preparing'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot assign an agent while order is "${order.status}".` });
    }

    const { data: agentProfile, error: agentError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', delivery_agent_id)
      .single();

    if (agentError || !agentProfile || agentProfile.role !== 'delivery_agent') {
      return res.status(400).json({ error: 'delivery_agent_id must belong to a valid delivery agent.' });
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_tracking')
      .upsert({ order_id: order.id, delivery_agent_id, status: 'assigned' }, { onConflict: 'order_id' })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('notifications').insert({
      user_id: order.user_id,
      title: 'Delivery agent assigned',
      body: `${agentProfile.full_name} will be delivering your order.`,
      type: 'order_update',
    });

    res.json({ message: 'Delivery agent assigned.', delivery_tracking: data });
  } catch (err) {
    next(err);
  }
}

export async function updateLocation(req, res, next) {
  try {
    const { lat, lng } = req.body;

    const { data: tracking, error } = await supabaseAdmin
      .from('delivery_tracking')
      .select('*')
      .eq('order_id', req.params.orderId)
      .single();

    if (error || !tracking) return res.status(404).json({ error: 'No delivery assigned to this order yet.' });

    if (tracking.delivery_agent_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Only the assigned delivery agent can update location.' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('delivery_tracking')
      .update({ current_lat: lat, current_lng: lng })
      .eq('order_id', req.params.orderId)
      .select()
      .single();

    if (updateError) throw updateError;
    res.json({ message: 'Location updated.', delivery_tracking: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateDeliveryStatus(req, res, next) {
  try {
    const { status } = req.body;

    const { data: tracking, error } = await supabaseAdmin
      .from('delivery_tracking')
      .select('*')
      .eq('order_id', req.params.orderId)
      .single();

    if (error || !tracking) return res.status(404).json({ error: 'No delivery assigned to this order yet.' });

    if (tracking.delivery_agent_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Only the assigned delivery agent can update delivery status.' });
    }

    const allowedNext = AGENT_TRANSITIONS[tracking.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({ error: `Cannot move delivery from "${tracking.status}" to "${status}".` });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('delivery_tracking')
      .update({ status })
      .eq('order_id', req.params.orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Keep the parent order's status roughly in sync with delivery progress
    const orderStatusMap = { picked_up: 'out_for_delivery', en_route: 'out_for_delivery', delivered: 'delivered' };
    if (orderStatusMap[status]) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .update({ status: orderStatusMap[status] })
        .eq('id', req.params.orderId)
        .select()
        .single();

      if (order) {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.user_id,
          title: 'Delivery update',
          body:
            status === 'delivered'
              ? 'Your order has been delivered. Enjoy your meal!'
              : `Your order is ${status.replace(/_/g, ' ')}.`,
          type: 'order_update',
        });
      }
    }

    res.json({ message: 'Delivery status updated.', delivery_tracking: updated });
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryTracking(req, res, next) {
  try {
    const order = await loadOrderWithRestaurant(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const { data: tracking, error } = await supabaseAdmin
      .from('delivery_tracking')
      .select('*')
      .eq('order_id', req.params.orderId)
      .maybeSingle();

    if (error) throw error;
    if (!tracking) return res.json({ delivery_tracking: null });

    const isCustomer = order.user_id === req.user.id;
    const isRestaurantOwner = order.restaurants.owner_id === req.user.id;
    const isAssignedAgent = tracking.delivery_agent_id === req.user.id;
    const isAdmin = req.profile.role === 'admin';

    if (!isCustomer && !isRestaurantOwner && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({ error: 'You do not have access to this delivery.' });
    }

    let agent = null;
    if (tracking.delivery_agent_id) {
      const { data: agentProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, phone')
        .eq('id', tracking.delivery_agent_id)
        .maybeSingle();
      agent = agentProfile || null;
    }

    res.json({ delivery_tracking: { ...tracking, agent } });
  } catch (err) {
    next(err);
  }
}

// For the delivery agent's own "my deliveries" dashboard
export async function listMyDeliveries(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('delivery_tracking')
      .select('*, orders(id, delivery_address, total_amount, status, restaurants(name, address))')
      .eq('delivery_agent_id', req.user.id)
      .neq('status', 'delivered')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json({ deliveries: data });
  } catch (err) {
    next(err);
  }
}
