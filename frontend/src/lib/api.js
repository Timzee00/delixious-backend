import axios from 'axios';
import { getCsrfToken, setCsrfToken } from './csrf.js';

// Production uses the same-origin Express API. VITE_API_URL remains available
// for local development or a separately hosted API.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  if (MUTATING_METHODS.has((config.method || '').toLowerCase())) {
    const token = getCsrfToken();
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh')
      .then((res) => {
        setCsrfToken(res.data.csrfToken);
        return res;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthRefreshRequest = config?.url?.endsWith('/auth/refresh');
    const isAuthBootstrapRequest = config?.url?.endsWith('/auth/me');
    const isExpiredToken = response?.status === 401 && response?.data?.code === 'TOKEN_EXPIRED';
    const isNoSession = response?.status === 401 && response?.data?.code === 'NO_SESSION';

    // The refresh request itself must never recursively trigger another refresh.
    if (isAuthRefreshRequest) {
      return Promise.reject(error);
    }

    // Expired access tokens can be recovered using the httpOnly refresh cookie.
    if (isExpiredToken && !config._retried) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch (refreshError) {
        // The refresh may have raced with a newer successful login.
        // Let the auth provider reconcile the session instead of clearing it here.
        return Promise.reject(refreshError);
      }
    }

    // A missing access cookie during initial app bootstrap can still have a
    // valid refresh cookie. Let AuthContext explicitly attempt refresh once.
    // Do not immediately erase auth state here for /auth/me.
    if (isNoSession && isAuthBootstrapRequest) {
      return Promise.reject(error);
    }

    // A 401 from a separate endpoint must not destroy a valid login session.
    // Session invalidation is owned by the explicit auth bootstrap/refresh flow.
    return Promise.reject(error);
  }
);

export { refreshSession };
export default api;
