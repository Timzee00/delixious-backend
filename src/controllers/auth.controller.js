import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { createSubaccount, createTransferRecipient } from '../utils/paystack.js';
import { setAuthCookies, clearAuthCookies } from '../utils/authCookies.js';
import logger from '../utils/logger.js';

export async function signup(req, res, next) {
  try {
    const { email, password, full_name, phone, role = 'customer' } = req.body;

    // Never accept the privileged admin role from public signup.
    // The database trigger also enforces this as defense-in-depth.
    const safeRole = role === 'restaurant_owner' || role === 'delivery_agent' ? role : 'customer';

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role: safeRole } },
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

    const subaccountResponse = await createSubaccount({
      businessName: req.profile.full_name,
      bankCode: bank_code,
      accountNumber: account_number,
      percentageCharge: 10,
    });

    if (!subaccountResponse.status) {
      return res.status(502).json({ error: 'Could not verify bank details with Paystack. Please check the details and try again.' });
    }

    const recipientResponse = await createTransferRecipient({
      name: req.profile.full_name,
      bankCode: bank_code,
      accountNumber: account_number,
    });

    if (!recipientResponse.status) {
      return res.status(502).json({ error: 'Could not set up payouts with Paystack. Please try again.' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        rider_bank_name: bank_name,
        rider_bank_account_number: account_number,
        rider_bank_account_name: subaccountResponse.data.account_name,
        rider_paystack_subaccount_code: subaccountResponse.data.subaccount_code,
        rider_transfer_recipient_code: recipientResponse.data.recipient_code,
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Your account profile could not be loaded. Please contact support.' });
    }

    if (profile.is_suspended) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Your account profile could not be loaded.', code: 'PROFILE_NOT_FOUND' });
    }

    if (profile.is_suspended) {
      clearAuthCookies(res);
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

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
    // The validation schema should only allow profile fields. Keep an explicit
    // allow-list here as defense-in-depth so a future schema change cannot
    // accidentally expose role, suspension, approval or payout fields.
    const { full_name, phone, avatar_url } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
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
