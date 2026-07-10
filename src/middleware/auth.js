import { supabaseAdmin } from '../config/supabase.js';

function extractToken(req) {
  if (req.cookies?.access_token) return req.cookies.access_token;
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

/**
 * Verifies the access token (from the httpOnly cookie, or an Authorization
 * header for non-browser API clients) and attaches the authenticated user +
 * their profile row to req.user / req.profile. Responds with a distinct
 * `code: 'TOKEN_EXPIRED'` on an invalid/expired token so the frontend can
 * tell "not logged in" apart from "logged in, but needs a token refresh".
 */
export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'You must be logged in to do this.', code: 'NO_SESSION' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
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
      return res.status(404).json({ error: 'User profile not found.' });
    }

    req.user = data.user;
    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restricts a route to specific profile roles.
 * Usage: requireRole('restaurant_owner', 'admin')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}
