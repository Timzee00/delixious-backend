import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { setAuthCookies, clearAuthCookies } from '../utils/authCookies.js';
import logger from '../utils/logger.js';

// NOTE: request body validation (email format, password length, allowed
// roles, etc) now happens in middleware/validate.js + schemas/auth.schema.js
// before these handlers run - req.body is already known-good here.

export async function signup(req, res, next) {
  try {
    const { email, password, full_name, phone, role } = req.body;

    // signUp via the anon client so Supabase's own auth rules/email
    // confirmation settings apply. The DB trigger (handle_new_user)
    // auto-creates the matching profiles row.
    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role } },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.session) {
      setAuthCookies(res, data.session);
    }

    res.status(201).json({
      message: data.session
        ? 'Account created successfully.'
        : 'Account created. Please check your email to confirm your account.',
      user: data.session ? { id: data.user.id, email: data.user.email } : undefined,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      // Deliberately generic - never reveal whether the email exists.
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).single();

    setAuthCookies(res, data.session);

    res.json({
      message: 'Logged in successfully.',
      user: { id: data.user.id, email: data.user.email },
      profile,
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

    setAuthCookies(res, data.session);

    res.json({ message: 'Session refreshed.', user: { id: data.user.id, email: data.user.email }, profile });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.access_token;

    if (token) {
      await supabaseAdmin.auth.admin.signOut(token).catch((err) => {
        // Non-fatal - we clear cookies regardless. Just log for visibility.
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
  res.json({ user: { id: req.user.id, email: req.user.email }, profile: req.profile });
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
