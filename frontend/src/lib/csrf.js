/**
 * The backend sets a csrf_token cookie that is deliberately NOT httpOnly -
 * only so this function can read it and echo it back as a header on
 * mutating requests (see lib/api.js). See the backend's middleware/csrf.js
 * for the full double-submit-cookie explanation.
 */
let currentToken = null;

function readCookieToken() {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCsrfToken(token) {
  currentToken = token || null;
}

export function getCsrfToken() {
  // The in-memory value is fastest after login/refresh. Falling back to the
  // browser cookie fixes the common reload case where the CSRF cookie still
  // exists but the JavaScript process has been recreated.
  return currentToken || readCookieToken();
}
