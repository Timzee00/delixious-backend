import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

const ROLE_LABELS = new Set(['manager', 'kitchen', 'counter']);
const INVITE_DAYS = 7;

async function ownedRestaurant(restaurantId, userId, isAdmin) {
  let query = supabaseAdmin.from('restaurants').select('id,name,owner_id').eq('id', restaurantId);
  if (!isAdmin) query = query.eq('owner_id', userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function authorizeStaff(restaurantId, req) {
  const { data: restaurant, error } = await supabaseAdmin.from('restaurants')
    .select('id,name,owner_id').eq('id', restaurantId).maybeSingle();
  if (error) throw error;
  if (!restaurant) return null;
  if (restaurant.owner_id === req.user.id || req.profile.role === 'admin') {
    return { restaurant, staff_role: 'owner' };
  }
  const { data: staff, error: staffError } = await supabaseAdmin.from('restaurant_staff')
    .select('staff_role').eq('restaurant_id', restaurantId)
    .eq('user_id', req.user.id).eq('active', true).maybeSingle();
  if (staffError) throw staffError;
  return staff ? { restaurant, staff_role: staff.staff_role } : null;
}

export async function listRestaurantTeam(req, res, next) {
  try {
    const restaurant = await ownedRestaurant(req.params.restaurantId, req.user.id, req.profile.role === 'admin');
    if (!restaurant) return res.status(403).json({ error: 'Only the restaurant owner can manage the team.' });
    const [{ data: members, error: e1 }, { data: invites, error: e2 }] = await Promise.all([
      supabaseAdmin.from('restaurant_staff').select('restaurant_id,user_id,staff_role,active,joined_at')
        .eq('restaurant_id', restaurant.id).order('joined_at', { ascending: false }).limit(100),
      supabaseAdmin.from('restaurant_staff_invites')
        .select('id,email,staff_role,created_at,expires_at,accepted_at')
        .eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (e1 || e2) throw e1 || e2;
    // Never leak authentication secrets, invite tokens, or another owner's data.
    res.set('Cache-Control', 'private, no-store');
    res.json({ members: members || [], invites: invites || [] });
  } catch (err) { next(err); }
}

export async function createTeamInvite(req, res, next) {
  try {
    const restaurant = await ownedRestaurant(req.params.restaurantId, req.user.id, req.profile.role === 'admin');
    if (!restaurant) return res.status(403).json({ error: 'Only the restaurant owner can invite staff.' });
    const { email, staff_role } = req.body;
    if (!ROLE_LABELS.has(staff_role)) return res.status(400).json({ error: 'Invalid staff permission level.' });
    if (email.toLowerCase() === req.user.email?.toLowerCase()) {
      return res.status(400).json({ error: 'The restaurant owner already has full access.' });
    }
    const secret = crypto.randomBytes(32).toString('hex');
    const token_hash = crypto.createHash('sha256').update(secret).digest('hex');
    const { data, error } = await supabaseAdmin.from('restaurant_staff_invites').insert({
      restaurant_id: restaurant.id, email: email.toLowerCase().trim(), staff_role,
      token_hash, invited_by: req.user.id,
      expires_at: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString(),
    }).select('id,email,staff_role,expires_at').single();
    if (error) throw error;
    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      invite: data,
      invite_url: `${base}/staff/join?token=${encodeURIComponent(secret)}`,
      warning: 'Share this single-use invitation privately with the intended staff member.',
    });
  } catch (err) { next(err); }
}

export async function acceptTeamInvite(req, res, next) {
  try {
    if (!req.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Verify your email address before accepting an invitation.' });
    }
    const token_hash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const { data: invite, error } = await supabaseAdmin.from('restaurant_staff_invites')
      .select('id,restaurant_id,email,staff_role,expires_at,accepted_at')
      .eq('token_hash', token_hash).maybeSingle();
    if (error) throw error;
    if (!invite || invite.accepted_at || new Date(invite.expires_at) <= new Date()) {
      return res.status(410).json({ error: 'This invitation has expired or has already been used.' });
    }
    if (invite.email !== req.user.email?.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation is for a different verified email address.' });
    }
    // Conditional consumption limits token replay; staging tests must also
    // cover membership persistence failure and concurrent acceptance.
    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from('restaurant_staff_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id).is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id').maybeSingle();
    if (consumeError) throw consumeError;
    if (!consumed) return res.status(409).json({ error: 'This invitation was already accepted.' });
    const { error: joinError } = await supabaseAdmin.from('restaurant_staff')
      .upsert({
        restaurant_id: invite.restaurant_id, user_id: req.user.id,
        staff_role: invite.staff_role, active: true, invited_by: null,
      }, { onConflict: 'restaurant_id,user_id' });
    if (joinError) throw joinError;
    res.json({ message: 'You have joined the restaurant team.', restaurant_id: invite.restaurant_id });
  } catch (err) { next(err); }
}

export async function updateTeamMember(req, res, next) {
  try {
    const restaurant = await ownedRestaurant(req.params.restaurantId, req.user.id, req.profile.role === 'admin');
    if (!restaurant) return res.status(403).json({ error: 'Only the owner can manage staff access.' });
    if (req.params.userId === restaurant.owner_id) return res.status(403).json({ error: 'Cannot change ownership through staff settings.' });
    const { active, staff_role } = req.body;
    const updates = {};
    if (typeof active === 'boolean') updates.active = active;
    if (staff_role) updates.staff_role = staff_role;
    const { data, error } = await supabaseAdmin.from('restaurant_staff')
      .update(updates).eq('restaurant_id', restaurant.id).eq('user_id', req.params.userId)
      .select('user_id,staff_role,active').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Staff member not found.' });
    res.json({ member: data });
  } catch (err) { next(err); }
}

export async function listMyStaffMemberships(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurant_staff')
      .select('restaurant_id,staff_role,restaurants!inner(id,name,logo_url,address)')
      .eq('user_id', req.user.id).eq('active', true)
      .limit(100);
    if (error) throw error;
    res.set('Cache-Control', 'private, no-store');
    res.json({ memberships: data || [] });
  } catch (err) { next(err); }
}

export async function listStaffOrders(req, res, next) {
  try {
    const access = await authorizeStaff(req.params.restaurantId, req);
    if (!access) return res.status(403).json({ error: 'You do not have access to this restaurant.' });
    const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20);
    const { data, error, count } = await supabaseAdmin.from('orders')
      .select('id,status,payment_status,created_at,order_items(id,name_snapshot,quantity)', { count: 'exact' })
      .eq('restaurant_id', access.restaurant.id)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.set('Cache-Control', 'private, no-store');
    res.json({ orders: data || [], page, limit, total: count ?? 0, staff_role: access.staff_role });
  } catch (err) { next(err); }
}

export async function changeStaffOrderStatus(req, res, next) {
  try {
    const { data: order, error: readError } = await supabaseAdmin.from('orders')
      .select('id,restaurant_id,status,payment_status').eq('id', req.params.orderId).maybeSingle();
    if (readError) throw readError;
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const access = await authorizeStaff(order.restaurant_id, req);
    if (!access) return res.status(403).json({ error: 'You do not have permission to manage this order.' });
    const allowed = {
      owner: { pending: 'confirmed', confirmed: 'preparing' },
      manager: { pending: 'confirmed', confirmed: 'preparing' },
      counter: { pending: 'confirmed' },
      kitchen: { confirmed: 'preparing' },
    }[access.staff_role];
    if (order.payment_status !== 'paid' || allowed?.[order.status] !== req.body.status) {
      return res.status(409).json({ error: 'This transition is not allowed for your role or the current order status.' });
    }
    const { data, error } = await supabaseAdmin.from('orders')
      .update({ status: req.body.status })
      .eq('id', order.id).eq('status', order.status).eq('payment_status', 'paid')
      .select('id,status').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'This order was updated by someone else. Refresh the queue.' });
    res.json({ order: data });
  } catch (err) { next(err); }
}
