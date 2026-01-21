// useAuth hook - Giriş durumu yönetimi
// Requirement 1.2: Kullanıcının oturumunu başlatmalı ve yetki durumunu kontrol etmeli
// Requirement 2.4: Her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı

import { useAuthContext, type AuthContextValue } from '@/contexts/AuthContext';

/**
 * useAuth hook - AuthContext'e erişim sağlar
 * 
 * @throws Error - AuthProvider dışında kullanıldığında hata fırlatır
 * @returns AuthContextValue - user, isLoading, isAuthenticated, login, logout, register, refreshUser
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, login, logout } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <LoginForm onSubmit={login} />;
 *   }
 *   
 *   return <div>Hoş geldin, {user?.username}!</div>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}

export default useAuth;
