import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { createTransferRecipient } from '../utils/paystack.js';
import { setAuthCookies, clearAuthCookies } from '../utils/authCookies.js';
import logger from '../utils/logger.js';

function publicProfile(profile) {
  if (!profile) return profile;
  const {
    rider_transfer_recipient_code,
    rider_paystack_subaccount_code,
    rider_bank_account_number,
    rider_bank_account_name,
    ...safe
  } = profile;
  return {
    ...safe,
    rider_payout_account_connected: Boolean(rider_transfer_recipient_code),
    rider_bank_account_last4: rider_bank_account_number ? String(rider_bank_account_number).slice(-4) : null,
  };
}

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

export async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    const redirectTo = `${process.env.FRONTEND_URL}/reset-password`;
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      // Do not reveal whether an account exists or is eligible for recovery.
      logger.warn('Password recovery email could not be queued', { message: error.message });
    }
    res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
  } catch (err) {
    // Keep the response identical to avoid account enumeration through provider errors.
    logger.error('Password recovery request failed', { error: err.message });
    res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
  }
}

export async function establishPasswordRecoverySession(req, res, next) {
  try {
    let session = null;
    let recoveryError = null;
    if (req.body.token_hash) {
      const { data, error } = await supabaseAnon.auth.verifyOtp({
        token_hash: req.body.token_hash,
        type: 'recovery',
      });
      session = data?.session || null;
      recoveryError = error;
    } else {
      const { data, error } = await supabaseAnon.auth.setSession({
        access_token: req.body.access_token,
        refresh_token: req.body.refresh_token,
      });
      session = data?.session || null;
      recoveryError = error;
    }

    if (recoveryError || !session?.user) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired. Request a new link.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      clearAuthCookies(res);
      return res.status(400).json({ error: 'Your account profile could not be loaded. Contact support.' });
    }
    if (profile.is_suspended) {
      clearAuthCookies(res);
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });
    }

    const csrfToken = setAuthCookies(res, session);
    res.json({
      message: 'Recovery link verified. Choose a new password.',
      user: { id: session.user.id, email: session.user.email },
      profile: publicProfile(profile),
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePassword(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      password: req.body.password,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password updated successfully.', user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    next(err);
  }
}

export async function submitRiderBankDetails(req, res, next) {
  try {
    const { bank_name, bank_code, account_number } = req.body;
    if (req.profile.rider_transfer_recipient_code) {
      return res.status(409).json({ error: 'A payout recipient is already connected. Contact support to change it safely.' });
    }

    // Rider payouts use a Paystack transfer recipient, not a restaurant subaccount.
    const recipientResponse = await createTransferRecipient({
      name: req.profile.full_name,
      bankCode: bank_code,
      accountNumber: account_number,
    });

    if (!recipientResponse.status || !recipientResponse.data?.recipient_code) {
      return res.status(502).json({ error: 'Could not set up rider payouts with Paystack. Please check the bank details and try again.' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        rider_bank_name: bank_name,
        rider_bank_account_number: account_number,
        rider_bank_account_name: recipientResponse.data.details?.account_name || req.profile.full_name,
        rider_transfer_recipient_code: recipientResponse.data.recipient_code,
      })
      .eq('id', req.user.id)
      .select('*')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Verified rider payout account connected.', profile: publicProfile(data) });
  } catch (err) {
    if (err.response?.data?.message) return res.status(400).json({ error: err.response.data.message });
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
    profile: publicProfile(req.profile),
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

    res.json({ message: 'Profile updated.', profile: publicProfile(data) });
  } catch (err) {
    next(err);
  }
}
