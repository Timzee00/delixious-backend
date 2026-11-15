import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { createSubaccount } from '../utils/paystack.js';

const PUBLIC_FIELDS = 'id, slug, name, description, cuisine_type, business_types, address, lat, lng, logo_url, cover_image_url, is_open, rating_avg, rating_count, created_at';
const MANAGEMENT_FIELDS = `${PUBLIC_FIELDS}, approval_status`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeRestaurant(data) {
  if (!data) return data;
  const { bank_name, bank_account_number, bank_account_name, paystack_subaccount_code, owner_id, ...safe } = data;
  return { ...safe, payout_account_connected: Boolean(paystack_subaccount_code) };
}

function safeRestaurants(rows = []) {
  return rows.map(safeRestaurant);
}

function createStoreSlug(name) {
  const base = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'food-business';
  return `${base}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function restaurantIdentifierQuery(identifier) {
  return UUID_RE.test(identifier)
    ? supabaseAdmin.from('restaurants').select(PUBLIC_FIELDS).eq('id', identifier)
    : supabaseAdmin.from('restaurants').select(PUBLIC_FIELDS).eq('slug', identifier);
}

export async function listRestaurants(req, res, next) {
  try {
    const { search, cuisine, business_type, is_open, page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('restaurants')
      .select(PUBLIC_FIELDS, { count: 'exact' })
      .eq('approval_status', 'approved')
      .order('rating_avg', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);

    if (search) query = query.ilike('name', `%${search}%`);
    if (cuisine) query = query.ilike('cuisine_type', `%${cuisine}%`);
    if (business_type) query = query.contains('business_types', [business_type]);
    if (is_open !== undefined) query = query.eq('is_open', is_open === 'true');

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ restaurants: data || [], total: count || 0, page, limit });
  } catch (err) { next(err); }
}

export async function getRestaurant(req, res, next) {
  try {
    const { data, error } = await restaurantIdentifierQuery(req.params.id)
      .eq('approval_status', 'approved')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Food business not found.' });
    res.json({ restaurant: data });
  } catch (err) { next(err); }
}

export async function getMyRestaurants(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const from = (page - 1) * limit;
    const { data, error, count } = await supabaseAdmin.from('restaurants')
      .select(`${MANAGEMENT_FIELDS}, paystack_subaccount_code`, { count: 'exact' })
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw error;
    res.json({ restaurants: safeRestaurants(data || []), total: count || 0, page, limit });
  } catch (err) { next(err); }
}

export async function createRestaurant(req, res, next) {
  try {
    const payload = {
      ...req.body,
      business_types: req.body.business_types || ['restaurant'],
      slug: createStoreSlug(req.body.name),
      owner_id: req.user.id,
    };
    const { data, error } = await supabaseAdmin.from('restaurants')
      .insert(payload)
      .select(`${MANAGEMENT_FIELDS}, paystack_subaccount_code`)
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Food business created.', restaurant: safeRestaurant(data) });
  } catch (err) { next(err); }
}

export async function updateRestaurant(req, res, next) {
  try {
    const updates = { ...req.body };
    delete updates.slug;
    delete updates.owner_id;
    const { data, error } = await supabaseAdmin.from('restaurants')
      .update(updates)
      .eq('id', req.restaurant.id)
      .select(`${MANAGEMENT_FIELDS}, paystack_subaccount_code`)
      .single();
    if (error) throw error;
    res.json({ message: 'Food business updated.', restaurant: safeRestaurant(data) });
  } catch (err) { next(err); }
}

export async function toggleOpen(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurants')
      .update({ is_open: !req.restaurant.is_open })
      .eq('id', req.restaurant.id)
      .select(`${MANAGEMENT_FIELDS}, paystack_subaccount_code`)
      .single();
    if (error) throw error;
    res.json({ message: `Storefront is now ${data.is_open ? 'open' : 'closed'}.`, restaurant: safeRestaurant(data) });
  } catch (err) { next(err); }
}

export async function deleteRestaurant(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('restaurants').delete().eq('id', req.restaurant.id);
    if (error) throw error;
    res.json({ message: 'Food business deleted.' });
  } catch (err) { next(err); }
}

export async function submitBankDetails(req, res, next) {
  try {
    const { bank_name, bank_code, account_number } = req.body;
    if (req.restaurant.paystack_subaccount_code) {
      return res.status(409).json({ error: 'A payout account is already connected. Contact support to change it safely.' });
    }
    const paystackResponse = await createSubaccount({
      businessName: req.restaurant.name,
      bankCode: bank_code,
      accountNumber: account_number,
      percentageCharge: 10,
    });
    if (!paystackResponse.status) {
      return res.status(502).json({ error: 'Could not verify bank details with Paystack. Please check the details and try again.' });
    }
    const { data, error } = await supabaseAdmin.from('restaurants').update({
      bank_name,
      bank_account_number: account_number,
      bank_account_name: paystackResponse.data.account_name,
      paystack_subaccount_code: paystackResponse.data.subaccount_code,
    }).eq('id', req.restaurant.id).select(`${MANAGEMENT_FIELDS}, paystack_subaccount_code`).single();
    if (error) throw error;
    res.json({ message: 'Payout account connected.', restaurant: safeRestaurant(data) });
  } catch (err) {
    if (err.response?.data?.message) return res.status(400).json({ error: err.response.data.message });
    next(err);
  }
}
