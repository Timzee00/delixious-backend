import { generateCsrfToken } from '../middleware/csrf.js';

const isProduction = process.env.NODE_ENV === 'production';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'none',
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
    sameSite: 'none',
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
