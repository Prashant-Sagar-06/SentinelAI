import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'sentinelai_token';

export const AuthContext = createContext({
  token: undefined,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

function readStoredToken() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    const v = raw ? String(raw) : '';
    if (!v) return '';
    if (v === 'null' || v === 'undefined') return '';
    return v;
  } catch {
    return '';
  }
}

function writeStoredToken(token) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, String(token || ''));
  } catch {
    // ignore
  }
}

function clearStoredToken() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }) {
  // `undefined` means "not yet hydrated" (prevents redirect flicker).
  const [token, setToken] = useState(undefined);

  useEffect(() => {
    const stored = readStoredToken();
    setToken(stored);
  }, []);

  const login = useCallback((nextToken) => {
    const normalized = String(nextToken || '').trim();
    writeStoredToken(normalized);
    setToken(normalized);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken('');
  }, []);

  const value = useMemo(() => {
    const isAuthenticated = Boolean(token);
    return { token, login, logout, isAuthenticated };
  }, [token, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
