import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken as saveToken, getStoredUser, setStoredUser, getSessionCode, setSessionCode, generateSessionCode } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [sessionCode, setSessionCodeState] = useState(getSessionCode);
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

  const register = useCallback(async (name, email, password) => {
    const { token, user: u } = await api.auth.register(name, email, password);
    saveToken(token);
    setStoredUser(u);
    setUser(u);
    const code = generateSessionCode();
    setSessionCode(code);
    setSessionCodeState(code);
    return u;
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
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const existingCode = getSessionCode();
    if (!existingCode) {
      const code = generateSessionCode();
      setSessionCode(code);
      setSessionCodeState(code);
    } else {
      setSessionCodeState(existingCode);
    }
    api.user.profile()
      .then((profile) => {
        const u = { ...getStoredUser(), ...profile };
        setStoredUser(u);
        setUser(u);
      })
      .catch(() => {
        saveToken(null);
        setStoredUser(null);
        setUser(null);
        setSessionCode(null);
        setSessionCodeState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, sessionCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
