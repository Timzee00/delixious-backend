import { supabaseAdmin } from '../config/supabase.js';

const ADMIN_PROFILE_FIELDS = 'id, full_name, email, phone, role, is_suspended, created_at';
const PAGE_MAX = 50;

function safePage(page, limit) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), PAGE_MAX);
  const safePageNumber = Math.max(Number(page) || 1, 1);
  return { page: safePageNumber, limit: safeLimit, from: (safePageNumber - 1) * safeLimit };
}

export async function getStats(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('admin_stats').select('*').single();
    if (error) throw error;
    res.json({ stats: data });
  } catch (err) { next(err); }
}

export async function listRestaurantsAdmin(req, res, next) {
  try {
    const { status } = req.query;
    const { page, limit, from } = safePage(req.query.page, req.query.limit);
    let query = supabaseAdmin
      .from('restaurants')
      .select('id, name, cuisine_type, business_types, address, approval_status, owner_id, paystack_subaccount_code, created_at', { count: 'estimated' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (status) query = query.eq('approval_status', status);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({
      restaurants: (data || []).map(row => {
        const { paystack_subaccount_code, ...safe } = row;
        return { ...safe, payout_account_connected: Boolean(paystack_subaccount_code) };
      }),
      total: count || 0, page, limit,
    });
  } catch (err) { next(err); }
}

export async function setRestaurantApproval(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurants').update({ approval_status: req.body.status })
      .eq('id', req.params.id).select('id, name, approval_status, owner_id').single();
    if (error) throw error;
    res.json({ message: 'Restaurant status updated.', restaurant: data });
  } catch (err) { next(err); }
}

export async function listRidersAdmin(req, res, next) {
  try {
    const { page, limit, from } = safePage(req.query.page, req.query.limit);
    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, rider_approval_status, rider_rating_avg, rider_rating_count, rider_transfer_recipient_code, rider_bank_name, created_at', { count: 'estimated' })
      .eq('role', 'delivery_agent')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw error;
    res.json({
      riders: (data || []).map(row => {
        const { rider_transfer_recipient_code, ...safe } = row;
        return { ...safe, payout_account_connected: Boolean(rider_transfer_recipient_code) };
      }),
      total: count || 0, page, limit,
    });
  } catch (err) { next(err); }
}

export async function setRiderApproval(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('profiles')
      .update({ rider_approval_status: req.body.status })
      .eq('id', req.params.id).eq('role', 'delivery_agent')
      .select('id, full_name, rider_approval_status').single();
    if (error) throw error;
    res.json({ message: 'Rider status updated.', rider: data });
  } catch (err) { next(err); }
}

export async function listUsersAdmin(req, res, next) {
  try {
    const { role } = req.query;
    const { page, limit, from } = safePage(req.query.page, req.query.limit);
    let query = supabaseAdmin.from('profiles')
      .select(ADMIN_PROFILE_FIELDS, { count: 'estimated' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (role) query = query.eq('role', role);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ users: data || [], total: count || 0, page, limit });
  } catch (err) { next(err); }
}

export async function setUserSuspension(req, res, next) {
  try {
    if (req.params.id === req.user.id && req.body.suspended) {
      return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
    }
    const { data, error } = await supabaseAdmin.from('profiles')
      .update({ is_suspended: req.body.suspended })
      .eq('id', req.params.id)
      .select('id, full_name, email, role, is_suspended').single();
    if (error) throw error;
    res.json({ message: 'User status updated.', user: data });
  } catch (err) { next(err); }
}

export async function listOrdersAdmin(req, res, next) {
  try {
    const { status } = req.query;
    const { page, limit, from } = safePage(req.query.page, req.query.limit);
    let query = supabaseAdmin.from('orders')
      .select('id, user_id, restaurant_id, status, payment_status, subtotal, delivery_fee, total_amount, platform_commission, rider_payout_amount, rider_payout_status, created_at, restaurants(name)', { count: 'estimated' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ orders: data || [], total: count || 0, page, limit });
  } catch (err) { next(err); }
}

export async function sendBroadcast(req, res, next) {
  try {
    const { title, message, role } = req.body;
    const { data, error } = await supabaseAdmin.rpc('admin_send_broadcast', {
      p_title: title,
      p_body: message,
      p_role: role || null,
    });
    if (error) throw error;
    res.status(201).json({ message: `Broadcast sent to ${Number(data || 0)} user(s).`, recipients: Number(data || 0) });
  } catch (err) { next(err); }
}
