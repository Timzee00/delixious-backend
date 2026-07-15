import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { createSubaccount } from '../utils/paystack.js';
import { setAuthCookies, clearAuthCookies } from '../utils/authCookies.js';
import logger from '../utils/logger.js';

export async function signup(req, res, next) {
  try {
    const { email, password, full_name, phone, role } = req.body;

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role } },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    let csrfToken;
    if (data.session) {
      csrfToken = setAuthCookies(res, data.session);
    }

    res.status(201).json({
      message: data.session
        ? 'Account created successfully.'
        : 'Account created. Please check your email to confirm your account.',
      user: data.session ? { id: data.user.id, email: data.user.email } : undefined,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function submitRiderBankDetails(req, res, next) {
  try {
    const { bank_name, bank_code, account_number } = req.body;

    const paystackResponse = await createSubaccount({
      businessName: req.profile.full_name,
      bankCode: bank_code,
      accountNumber: account_number,
      percentageCharge: 10, // platform's 10% cut of the delivery fee
    });

    if (!paystackResponse.status) {
      return res.status(502).json({ error: 'Could not verify bank details with Paystack. Please check the details and try again.' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        rider_bank_name: bank_name,
        rider_bank_account_number: account_number,
        rider_bank_account_name: paystackResponse.data.account_name,
        rider_paystack_subaccount_code: paystackResponse.data.subaccount_code,
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Payout account connected.', profile: data });
  } catch (err) {
    if (err.response?.data?.message) {
      return res.status(400).json({ error: err.response.data.message });
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).single();

    const csrfToken = setAuthCookies(res, data.session);

    res.json({
      message: 'Logged in successfully.',
      user: { id: data.user.id, email: data.user.email },
      profile,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No session to refresh. Please log in again.', code: 'NO_SESSION' });
    }

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ error: 'Your session has expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).single();

    const csrfToken = setAuthCookies(res, data.session);

    res.json({
      message: 'Session refreshed.',
      user: { id: data.user.id, email: data.user.email },
      profile,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.access_token;

    if (token) {
      await supabaseAdmin.auth.admin.signOut(token).catch((err) => {
        logger.warn('Supabase signOut call failed during logout', { error: err.message });
      });
    }

    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: req.profile,
    csrfToken: req.cookies?.csrf_token,
  });
}

export async function updateProfile(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(req.body)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Profile updated.', profile: data });
  } catch (err) {
    next(err);
  }
}
