import { generateCsrfToken } from '../middleware/csrf.js';

const isProduction = process.env.NODE_ENV === 'production';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function baseCookieOptions() {
  return {
    httpOnly: true,
    // secure requires HTTPS - only enforce in production so local http://
    // development still works without extra setup.
    secure: isProduction,
    sameSite: 'lax',
  };
}

/**
 * Sets the three auth cookies after a successful login/signup/refresh:
 * - access_token: httpOnly, sent on every request, short-lived (matches Supabase's expires_in)
 * - refresh_token: httpOnly, scoped to /api/auth only (reduces exposure), long-lived
 * - csrf_token: NOT httpOnly (frontend JS must read it to echo it back), see middleware/csrf.js
 */
export function setAuthCookies(res, session) {
  const accessMaxAge = session.expires_in ? session.expires_in * 1000 : 60 * 60 * 1000;

  res.cookie('access_token', session.access_token, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: accessMaxAge,
  });

  res.cookie('refresh_token', session.refresh_token, {
    ...baseCookieOptions(),
    path: '/api/auth',
    maxAge: THIRTY_DAYS_MS,
  });

  const csrfToken = generateCsrfToken();
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_MS,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth' });
  res.clearCookie('csrf_token', { path: '/' });
}
