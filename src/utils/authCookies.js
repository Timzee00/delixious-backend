import { generateCsrfToken } from '../middleware/csrf.js';

// Render should set NODE_ENV=production, but also recognize the hosted
// frontend URL so cookies remain secure if NODE_ENV is omitted/misconfigured.
const isProduction =
  process.env.NODE_ENV === 'production' ||
  /^https:\/\//i.test(process.env.FRONTEND_URL || '');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    // Lax works on same-site localhost ports and on same-origin production hosting.
    // SameSite=None without Secure is rejected by modern browsers.
    sameSite: 'lax',
  };
}

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

  return csrfToken;
}

export function clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth' });
  res.clearCookie('csrf_token', { path: '/' });
}
