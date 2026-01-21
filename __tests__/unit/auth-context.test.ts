/**
 * Auth Context ve Hooks Unit Testleri
 * Validates: Requirements 1.2, 2.4
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Import after mocks
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';

describe('Auth Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    mockFetch.mockReset();
  });

  describe('useAuth hook', () => {
    it('AuthProvider dışında kullanıldığında hata fırlatmalı', () => {
      // Console error'u sustur
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuthContext must be used within an AuthProvider');
      
      consoleSpy.mockRestore();
    });

    it('AuthProvider içinde kullanıldığında context değerlerini döndürmeli', async () => {
      // Mock /api/auth/me endpoint - token yok durumu
      mockLocalStorage.getItem.mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(AuthProvider, null, children)
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Loading tamamlandığında
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.register).toBe('function');
      expect(typeof result.current.refreshUser).toBe('function');
    });
  });

  describe('login fonksiyonu', () => {
    it('başarılı giriş sonrası user ve token ayarlanmalı', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        status: 'approved',
        role: 'mod',
      };

      // Token yok
      mockLocalStorage.getItem.mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(AuthProvider, null, children)
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Login çağrısı için mock
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          token: 'test-token-123',
          user: mockUser,
        }),
      });

      let loginResult: { success: boolean; error?: string };
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password123');
      });

      expect(loginResult!.success).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'test-token-123');
    });

    it('başarısız giriş sonrası hata döndürmeli', async () => {
      // Token yok
      mockLocalStorage.getItem.mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(AuthProvider, null, children)
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Başarısız login
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Email veya şifre hatalı',
        }),
      });

      let loginResult: { success: boolean; error?: string };
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'wrongpassword');
      });

      expect(loginResult!.success).toBe(false);
      expect(loginResult!.error).toBe('Email veya şifre hatalı');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout fonksiyonu', () => {
    it('çıkış sonrası user null olmalı ve token silinmeli', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        status: 'approved',
        role: 'mod',
      };

      // Token var, /api/auth/me başarılı
      mockLocalStorage.getItem.mockReturnValue('existing-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(AuthProvider, null, children)
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).toEqual(mockUser);
      });

      // Logout çağrısı
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Çıkış başarılı' }),
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('register fonksiyonu', () => {
    it('başarılı kayıt sonrası success true döndürmeli', async () => {
      // Token yok
      mockLocalStorage.getItem.mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(AuthProvider, null, children)
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Register çağrısı
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Kayıt başarılı. Hesabınız onay bekliyor.',
          userId: 'new-user-id',
        }),
      });

      let registerResult: { success: boolean; error?: string };
      await act(async () => {
        registerResult = await result.current.register('newuser', 'new@example.com', 'password123');
      });

      expect(registerResult!.success).toBe(true);
      // Kayıt sonrası otomatik giriş yapılmaz, user null kalmalı
      expect(result.current.user).toBeNull();
    });
  });

  describe('refreshUser fonksiyonu', () => {
    it('token varsa kullanıcı bilgisini yenilemeli', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        status: 'approved',
        role: 'mod',
      };

      // İlk yükleme - token yok
      mockLocalStorage.getItem.mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(AuthProvider, null, children)
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Token'ı manuel olarak ayarla
      mockLocalStorage.getItem.mockReturnValue('new-token');

      // refreshUser çağrısı
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });
});

describe('ProtectedRoute', () => {
  // ProtectedRoute testleri için ayrı bir test dosyası oluşturulabilir
  // Bu testler Next.js router mock'u gerektirir
  it.todo('giriş yapılmamışsa login sayfasına yönlendirmeli');
  it.todo('beklemede durumundaki kullanıcıyı pending sayfasına yönlendirmeli');
  it.todo('yetersiz yetkili kullanıcıyı unauthorized sayfasına yönlendirmeli');
  it.todo('onaylı ve yetkili kullanıcıya içeriği göstermeli');
});
