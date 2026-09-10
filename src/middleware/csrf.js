import crypto from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Authentication bootstrap routes do not have an authenticated access-token
// session to protect. Refresh is additionally gated by the httpOnly refresh
// cookie and never exposes the refreshed tokens to the caller.
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/payments/webhook',
]);

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Please refresh the page and try again.' });
  }

  next();
}
