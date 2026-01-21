'use client';

// AuthContext - Oturum state yönetimi
// Requirement 1.2: Kullanıcının oturumunu başlatmalı ve yetki durumunu kontrol etmeli
// Requirement 2.4: Her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from '@/types';

// API Response tipleri
interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
}

interface MeResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// Auth Context değerleri
export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

// Context oluştur
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// localStorage key
const TOKEN_KEY = 'auth_token';

// Token yönetimi yardımcı fonksiyonları
function getStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  // Önce cookie'den dene, sonra localStorage'dan
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth_token='))
    ?.split('=')[1];
  
  if (cookieToken) {
    return cookieToken;
  }
  
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  // Hem cookie'ye hem localStorage'a kaydet
  // Cookie: 7 gün geçerli, path=/, SameSite=Lax
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  document.cookie = `auth_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  
  localStorage.setItem(TOKEN_KEY, token);
}

function removeStoredToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  // Cookie'yi sil (geçmiş tarih vererek)
  document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  localStorage.removeItem(TOKEN_KEY);
}

// AuthProvider bileşeni
export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Kullanıcı bilgisini token ile getir
  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: MeResponse = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
      } else {
        // Token geçersiz veya süresi dolmuş
        removeStoredToken();
        setUser(null);
      }
    } catch (error) {
      console.error('Kullanıcı bilgisi alınamadı:', error);
      removeStoredToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Uygulama yüklendiğinde token varsa kullanıcı bilgisini getir
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Giriş fonksiyonu
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Cookie'lerin gönderilmesi ve alınması için
        body: JSON.stringify({ email, password }),
      });

      const data: LoginResponse = await response.json();

      // HTTP status kontrolü - 401, 400 vb. durumlarında success false olmalı
      if (!response.ok) {
        return { success: false, error: data.error || 'Giriş başarısız' };
      }

      if (data.success && data.token && data.user) {
        // Token'ı localStorage'a da kaydet (yedek olarak)
        setStoredToken(data.token);
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data.error || 'Giriş başarısız' };
    } catch (error) {
      console.error('Giriş hatası:', error);
      return { success: false, error: 'Giriş işlemi sırasında bir hata oluştu' };
    }
  }, []);

  // Çıkış fonksiyonu
  const logout = useCallback(async () => {
    const token = getStoredToken();

    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Çıkış hatası:', error);
      }
    }

    removeStoredToken();
    setUser(null);
  }, []);

  // Kayıt fonksiyonu
  const register = useCallback(async (
    username: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data: RegisterResponse = await response.json();

      if (data.success) {
        return { success: true };
      }

      return { success: false, error: data.message || 'Kayıt başarısız' };
    } catch (error) {
      console.error('Kayıt hatası:', error);
      return { success: false, error: 'Kayıt işlemi sırasında bir hata oluştu' };
    }
  }, []);

  // isAuthenticated hesaplanmış değer
  const isAuthenticated = useMemo(() => user !== null, [user]);

  // Context değeri
  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    refreshUser,
  }), [user, isLoading, isAuthenticated, login, logout, register, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuthContext hook - internal kullanım için
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}

// Export context for direct access if needed
export { AuthContext };
