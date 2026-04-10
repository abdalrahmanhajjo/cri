import { createContext, useContext, useState, useEffect, useCallback, startTransition } from 'react';
import { api, getToken, setToken as saveToken, getStoredUser, setStoredUser, getSessionCode, setSessionCode, generateSessionCode } from '../api/client';

const AuthContext = createContext(null);

/** Background session check — does not toggle `loading` (avoids full-screen gate flicker on admin/business). */
const SESSION_PROFILE_REFRESH_MS = 15 * 60 * 1000;

/** If there is no token, ignore stale `user` in localStorage (avoids admin UI with 401 on every API call). */
function initialUser() {
  if (!getToken()) return null;
  return getStoredUser();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(initialUser);
  const [sessionCode, setSessionCodeState] = useState(() => (getToken() ? getSessionCode() : null));
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await api.auth.login(email, password);
    saveToken(token);
    setStoredUser(u);
    setUser(u);
    const code = generateSessionCode();
    setSessionCode(code);
    setSessionCodeState(code);
    return u;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const { token, user: u } = await api.auth.google(credential);
    saveToken(token);
    setStoredUser(u);
    setUser(u);
    const code = generateSessionCode();
    setSessionCode(code);
    setSessionCodeState(code);
    return u;
  }, []);

  const register = useCallback(async (name, username, email, password) => {
    const data = await api.auth.register(name, username, email, password);
    const { user: u, verificationEmailDelivered, requiresEmailVerification } = data;
    return { user: u, verificationEmailDelivered, requiresEmailVerification };
  }, []);

  /** Same session shape as login/register — used after POST /api/auth/verify-email (shared with the mobile app). */
  const applySession = useCallback((payload) => {
    const { token, user: u } = payload || {};
    if (!token || !u) return;
    saveToken(token);
    setStoredUser(u);
    setUser(u);
    const code = generateSessionCode();
    setSessionCode(code);
    setSessionCodeState(code);
  }, []);

  const logout = useCallback(() => {
    saveToken(null);
    setStoredUser(null);
    setUser(null);
    setSessionCode(null);
    setSessionCodeState(null);
  }, []);

  const refreshUser = useCallback(() => {
    return api.user.profile().then((profile) => {
      const u = { ...getStoredUser(), ...profile };
      setStoredUser(u);
      setUser(u);
      return u;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncLogout = () => {
      setUser(null);
      setSessionCodeState(null);
    };
    window.addEventListener('tripoli:auth-expired', syncLogout);
    return () => window.removeEventListener('tripoli:auth-expired', syncLogout);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      startTransition(() => {
        setStoredUser(null);
        setUser(null);
        setSessionCode(null);
        setSessionCodeState(null);
        setLoading(false);
      });
      return;
    }
    startTransition(() => {
      const existingCode = getSessionCode();
      if (!existingCode) {
        const code = generateSessionCode();
        setSessionCode(code);
        setSessionCodeState(code);
      } else {
        setSessionCodeState(existingCode);
      }
    });
    api.user.profile()
      .then((profile) => {
        const u = { ...getStoredUser(), ...profile };
        setStoredUser(u);
        setUser(u);
      })
      .catch((err) => {
        const status = err?.status;
        const code = err?.data?.code;
        const shouldClearSession =
          status === 401 ||
          status === 404 ||
          (status === 403 && (code === 'ACCOUNT_BLOCKED' || code === 'EMAIL_NOT_VERIFIED'));
        if (shouldClearSession) {
          saveToken(null);
          setStoredUser(null);
          setUser(null);
          setSessionCode(null);
          setSessionCodeState(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const id = window.setInterval(() => {
      const token = getToken();
      if (!token) return;
      api.user
        .profile()
        .then((profile) => {
          const u = { ...getStoredUser(), ...profile };
          setStoredUser(u);
          setUser(u);
        })
        .catch((err) => {
          const status = err?.status;
          const code = err?.data?.code;
          const shouldClearSession =
            status === 401 ||
            status === 404 ||
            (status === 403 && (code === 'ACCOUNT_BLOCKED' || code === 'EMAIL_NOT_VERIFIED'));
          if (shouldClearSession) {
            saveToken(null);
            setStoredUser(null);
            setUser(null);
            setSessionCode(null);
            setSessionCodeState(null);
          }
        });
    }, SESSION_PROFILE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginWithGoogle, register, applySession, logout, refreshUser, sessionCode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook export is intentional (standard React pattern).
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
