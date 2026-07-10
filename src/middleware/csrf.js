import crypto from 'crypto';

// Double-submit cookie CSRF protection: the csrf_token cookie is NOT
// httpOnly (the frontend JS needs to read it), while access/refresh tokens
// ARE httpOnly. A cross-site request can make the browser send cookies
// automatically, but it cannot read the cookie value to also set the
// matching X-CSRF-Token header - so a mismatch means the request didn't
// originate from a page that could read our cookies (same-origin only).

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Routes that don't have a session yet (nothing to protect) or are
// protected by another mechanism entirely (Paystack's signature check).
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/signup', '/api/payments/webhook']);

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
