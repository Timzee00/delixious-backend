import { supabaseAdmin } from '../config/supabase.js';

function extractToken(req) {
  if (req.cookies?.access_token) return req.cookies.access_token;
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

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
        .json({ error: 'Your session has expired. Please refresh your session.', code: 'TOKEN_EXPIRED' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found.', code: 'PROFILE_NOT_FOUND' });
    }

    if (profile.is_suspended) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

    req.user = data.user;
    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
}

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
