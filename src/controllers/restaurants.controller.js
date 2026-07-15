import { supabaseAdmin } from '../config/supabase.js';
import { createSubaccount } from '../utils/paystack.js';
const PUBLIC_FIELDS =
  'id, name, description, cuisine_type, address, lat, lng, logo_url, cover_image_url, is_open, rating_avg, rating_count, created_at';

export async function listRestaurants(req, res, next) {
  try {
    // req.query is already validated + coerced (numbers, defaults) by
    // validate({ query: listRestaurantsQuerySchema }) in the route.
    const { search, cuisine, is_open, page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('restaurants')
      .select(PUBLIC_FIELDS, { count: 'exact' })
      .order('rating_avg', { ascending: false })
      .range(from, to);

    if (search) query = query.ilike('name', `%${search}%`);
    if (cuisine) query = query.ilike('cuisine_type', `%${cuisine}%`);
    if (is_open !== undefined) query = query.eq('is_open', is_open === 'true');

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    res.json({ restaurants: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function getRestaurant(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .select(PUBLIC_FIELDS)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Restaurant not found.' });
    res.json({ restaurant: data });
  } catch (err) {
    next(err);
  }
}

export async function getMyRestaurants(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ restaurants: data });
  } catch (err) {
    next(err);
  }
}

export async function createRestaurant(req, res, next) {
  try {
    // req.body is already validated (name/address required, etc) by
    // validate({ body: createRestaurantSchema }) in the route.
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .insert({ ...req.body, owner_id: req.user.id })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Restaurant created.', restaurant: data });
  } catch (err) {
    next(err);
  }
}

export async function updateRestaurant(req, res, next) {
  try {
    // updateRestaurantSchema.partial() already limits req.body to known,
    // optional fields - zod strips anything else, so no manual allow-list
    // is needed here anymore.
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .update(req.body)
      .eq('id', req.restaurant.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Restaurant updated.', restaurant: data });
  } catch (err) {
    next(err);
  }
}

export async function toggleOpen(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .update({ is_open: !req.restaurant.is_open })
      .eq('id', req.restaurant.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: `Restaurant is now ${data.is_open ? 'open' : 'closed'}.`, restaurant: data });
  } catch (err) {
    next(err);
  }
}

export async function deleteRestaurant(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('restaurants').delete().eq('id', req.restaurant.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Restaurant deleted.' });
  } catch (err) {
    next(err);
  }
}
export async function submitBankDetails(req, res, next) {
  try {
    const { bank_name, bank_code, account_number } = req.body;

    const paystackResponse = await createSubaccount({
      businessName: req.restaurant.name,
      bankCode: bank_code,
      accountNumber: account_number,
      percentageCharge: 10, // platform's 10% commission
    });

    if (!paystackResponse.status) {
      return res.status(502).json({ error: 'Could not verify bank details with Paystack. Please check the details and try again.' });
    }

    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .update({
        bank_name,
        bank_account_number: account_number,
        bank_account_name: paystackResponse.data.account_name,
        paystack_subaccount_code: paystackResponse.data.subaccount_code,
      })
      .eq('id', req.restaurant.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Payout account connected.', restaurant: data });
  } catch (err) {
    if (err.response?.data?.message) {
      return res.status(400).json({ error: err.response.data.message });
    }
    next(err);
  }
}
