'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  login: () => false,
  logout: () => {},
});

// Şifre hash'i - "saniye2024" şifresinin basit hash'i
// Gerçek güvenlik için bu yeterli değil ama client-side koruma için yeterli
const ADMIN_HASH = 'c2FuaXllMjAyNA==';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('auth');
    if (stored === ADMIN_HASH) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = useCallback((password: string): boolean => {
    const hash = btoa(password);
    if (hash === ADMIN_HASH) {
      sessionStorage.setItem('auth', hash);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth');
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
