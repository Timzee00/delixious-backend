import { supabaseAdmin } from '../config/supabase.js';
import { restaurantAcceptingBySchedule } from '../utils/restaurantHours.js';
import { createSubaccount, listBanks, resolveBankAccount, getPaystackMode } from '../utils/paystack.js';

const PUBLIC_FIELDS = 'id, name, description, cuisine_type, address, lat, lng, logo_url, cover_image_url, is_open, rating_avg, rating_count, created_at';
const MANAGEMENT_FIELDS = `${PUBLIC_FIELDS}, approval_status`;
const PRIVATE_MANAGEMENT_FIELDS = `${MANAGEMENT_FIELDS}, bank_name, bank_account_name, bank_account_number, paystack_subaccount_code, payout_mode`;

function safeRestaurant(data) {
  if (!data) return data;
  const { bank_name, bank_account_number, bank_account_name, paystack_subaccount_code, payout_mode, owner_id, ...safe } = data;
  return {
    ...safe,
    payout: {
      ready: Boolean(paystack_subaccount_code && payout_mode === getPaystackMode()),
      bank_name: bank_name || null,
      account_name: bank_account_name || null,
      account_last4: bank_account_number ? bank_account_number.slice(-4) : null,
    },
  };
}

async function withEffectiveAvailability(restaurants) {
  if (!restaurants?.length) return [];
  const ids = restaurants.map((r) => r.id);
  const { data, error } = await supabaseAdmin.from('restaurant_operating_settings')
    .select('restaurant_id, schedule_enabled, weekly_hours').in('restaurant_id', ids);
  if (error) throw error;
  const settingsByRestaurant = new Map((data || []).map((setting) => [setting.restaurant_id, setting]));
  return restaurants.map((restaurant) => {
    const settings = settingsByRestaurant.get(restaurant.id);
    return {
      ...restaurant,
      accepting_orders: Boolean(restaurant.is_open)
        && (!settings?.schedule_enabled || restaurantAcceptingBySchedule(settings.weekly_hours)),
    };
  });
}

export async function listRestaurants(req, res, next) {
  try {
    const { search, cuisine, is_open, page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = supabaseAdmin.from('restaurants').select(PUBLIC_FIELDS, { count: 'exact' }).eq('approval_status', 'approved').order('rating_avg', { ascending: false }).range(from, to);
    if (search) query = query.ilike('name', `%${search}%`);
    if (cuisine) query = query.ilike('cuisine_type', `%${cuisine}%`);
    if (is_open !== undefined) query = query.eq('is_open', is_open === 'true');
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ restaurants: await withEffectiveAvailability(data), total: count, page, limit });
  } catch (err) { next(err); }
}

export async function getRestaurant(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurants').select(PUBLIC_FIELDS).eq('id', req.params.id).eq('approval_status', 'approved').single();
    if (error || !data) return res.status(404).json({ error: 'Restaurant not found.' });
    res.json({ restaurant: (await withEffectiveAvailability([data]))[0] });
  } catch (err) { next(err); }
}

export async function getMyRestaurants(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurants').select(PRIVATE_MANAGEMENT_FIELDS).eq('owner_id', req.user.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ restaurants: (data || []).map(safeRestaurant) });
  } catch (err) { next(err); }
}

export async function createRestaurant(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurants').insert({ ...req.body, owner_id: req.user.id }).select(MANAGEMENT_FIELDS).single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Restaurant created.', restaurant: safeRestaurant(data) });
  } catch (err) { next(err); }
}

export async function updateRestaurant(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurants').update(req.body).eq('id', req.restaurant.id).select(MANAGEMENT_FIELDS).single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Restaurant updated.', restaurant: safeRestaurant({ ...req.restaurant, ...data }) });
  } catch (err) { next(err); }
}

export async function toggleOpen(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurants').update({ is_open: !req.restaurant.is_open }).eq('id', req.restaurant.id).select(MANAGEMENT_FIELDS).single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: `Restaurant is now ${data.is_open ? 'open' : 'closed'}.`, restaurant: safeRestaurant({ ...req.restaurant, ...data }) });
  } catch (err) { next(err); }
}

export async function deleteRestaurant(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('restaurants').delete().eq('id', req.restaurant.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Restaurant deleted.' });
  } catch (err) { next(err); }
}

export async function getPayoutBanks(req, res, next) {
  try {
    const result = await listBanks();
    if (!result.status || !Array.isArray(result.data)) {
      return res.status(502).json({ error: 'Bank directory temporarily unavailable.' });
    }
    const banks = result.data
      .filter((bank) => bank.active !== false && bank.code && bank.name)
      .map((bank) => ({ code: String(bank.code), name: String(bank.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.set('Cache-Control', 'private, max-age=3600');
    res.json({ banks, mode: getPaystackMode() });
  } catch (err) {
    if (err.response || err.code === 'ECONNABORTED') {
      return res.status(502).json({ error: 'Could not load banks from the payment provider. Please try again.' });
    }
    next(err);
  }
}

export async function submitBankDetails(req, res, next) {
  try {
    if (req.restaurant.paystack_subaccount_code) {
      return res.status(409).json({
        code: 'PAYOUT_ALREADY_CONNECTED',
        error: 'A payout account is already connected. Contact support to change it securely.',
      });
    }
    const mode = getPaystackMode();
    if (!mode) return res.status(503).json({ error: 'Paystack payment mode is not configured correctly.' });
    const { bank_code, account_number } = req.body;
    const directory = await listBanks();
    const selectedBank = directory.data?.find((bank) =>
      String(bank.code) === bank_code && bank.active !== false
    );
    if (!directory.status || !selectedBank) {
      return res.status(400).json({ error: 'Choose a supported bank from the list.' });
    }

    const verified = await resolveBankAccount({ bankCode: bank_code, accountNumber: account_number });
    const accountName = verified.data?.account_name;
    if (!verified.status || !accountName) {
      return res.status(400).json({ error: 'Could not verify the account holder. Please check the bank and account number.' });
    }
    const result = await createSubaccount({
      businessName: req.restaurant.name,
      bankCode: bank_code,
      accountNumber: account_number,
      percentageCharge: 10,
    });
    if (!result.status || !result.data?.subaccount_code) {
      return res.status(502).json({ error: 'Payment provider could not connect this bank account. Try again later.' });
    }

    const { data, error } = await supabaseAdmin.from('restaurants').update({
      bank_name: selectedBank.name,
      // Retain only the final four digits; Paystack keeps the settlement details.
      bank_account_number: account_number.slice(-4),
      bank_account_name: accountName,
      paystack_subaccount_code: result.data.subaccount_code,
      payout_mode: mode,
    }).eq('id', req.restaurant.id).is('paystack_subaccount_code', null)
      .select(PRIVATE_MANAGEMENT_FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'Payout account was updated elsewhere. Refresh and try again.' });
    res.json({ message: 'Payout account verified and connected.', restaurant: safeRestaurant(data) });
  } catch (err) {
    if (err.response?.data || err.code === 'ECONNABORTED') {
      return res.status(400).json({ error: 'Bank verification or setup failed. Please confirm your bank details and try again.' });
    }
    next(err);
  }
}
