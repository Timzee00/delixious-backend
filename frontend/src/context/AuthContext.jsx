import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api, { refreshSession, setUnauthorizedHandler } from '../lib/api.js';
import { setCsrfToken } from '../lib/csrf.js';

const AuthContext = createContext(null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Prevent an older startup request from overwriting a newer login.
  const sessionGeneration = useRef(0);

  const applySession = useCallback((data) => {
    setUser(data.user);
    setProfile(data.profile);
    setCsrfToken(data.csrfToken);
    return data.profile;
  }, []);

  const refreshProfile = useCallback(async () => {
    let lastError = null;
    const generation = sessionGeneration.current;
    const isCurrent = () => generation === sessionGeneration.current;

    // A fresh browser can briefly be offline, waking from sleep, or waiting
    // for its first network connection. Retry bootstrap before deciding that
    // the user is logged out instead of bouncing them to /login prematurely.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data } = await api.get('/auth/me');
        return isCurrent() ? applySession(data) : null;
      } catch (error) {
        lastError = error;

        // If the access cookie is missing/expired, try the long-lived refresh
        // cookie once. refreshSession is intentionally allowed without a CSRF
        // header by the backend because it is itself authenticated by the
        // httpOnly refresh cookie.
        const code = error.response?.data?.code;
        if (error.response?.status === 401 && (code === 'NO_SESSION' || code === 'TOKEN_EXPIRED')) {
          try {
            const { data } = await refreshSession();
            return isCurrent() ? applySession(data) : null;
          } catch (refreshError) {
            lastError = refreshError;
          }
        }

        if (!error.response && attempt === 0) {
          await sleep(350);
          continue;
        }
        break;
      }
    }

    // Only clear an existing session when the server explicitly says it is
    // invalid/forbidden. Network failures must not wipe a valid local auth UI.
    if (isCurrent() && (lastError?.response?.status === 401 || lastError?.response?.status === 403)) {
      setUser(null);
      setProfile(null);
    }
    return null;
  }, [applySession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setProfile(null);
    });

    (async () => {
      await refreshProfile();
      setLoading(false);
    })();
  }, [refreshProfile]);

  async function login(email, password) {
    sessionGeneration.current += 1;
    const { data } = await api.post('/auth/login', { email, password });
    applySession(data);
    return data;
  }

  async function signup(payload) {
    const { data } = await api.post('/auth/signup', payload);
    if (data.user) {
      await refreshProfile();
    }
    return data;
  }

  async function logout() {
    sessionGeneration.current += 1;
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore server errors; local auth state must still be cleared.
    }
    setUser(null);
    setProfile(null);
    setCsrfToken(null);
  }

  async function updateProfile(payload) {
    const { data } = await api.put('/auth/profile', payload);
    setProfile(data.profile);
    return data;
  }

  const value = {
    user,
    profile,
    loading,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated: Boolean(profile),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider.');
  return ctx;
}
