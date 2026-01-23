'use client';

// ProtectedRoute - Korumalı sayfa wrapper bileşeni
// Requirement 2.1: Onaylanmamış veya yetkisiz kullanıcılar sadece engelleme mesajını görmeli
// Requirement 2.2: Onaylı yetkili yetki seviyesine göre uygun içeriği görmeli
// Requirement 2.3: "Beklemede" durumundaki kullanıcılar ana içeriğe erişememeli
// Requirement 2.4: Her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Gerekli minimum yetki seviyesi (opsiyonel) */
  requiredRole?: UserRole;
  /** Yükleme durumunda gösterilecek bileşen */
  loadingComponent?: React.ReactNode;
  /** Yetkisiz erişimde yönlendirilecek sayfa (varsayılan: /unauthorized) */
  unauthorizedRedirect?: string;
  /** Giriş yapılmamışsa yönlendirilecek sayfa (varsayılan: /login) */
  loginRedirect?: string;
  /** Beklemede durumunda yönlendirilecek sayfa (varsayılan: /pending) */
  pendingRedirect?: string;
}

// Yetki seviyesi hiyerarşisi
const ROLE_HIERARCHY: Record<UserRole, number> = {
  none: 0,
  mod: 1,
  admin: 2,
  ust_yetkili: 3,
};

/**
 * Kullanıcının gerekli yetkiye sahip olup olmadığını kontrol eder
 */
function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Varsayılan yükleme bileşeni
 */
function DefaultLoadingComponent(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-600 border-t-blue-500" />
        <p className="text-sm text-zinc-400">Yükleniyor...</p>
      </div>
    </div>
  );
}

/**
 * ProtectedRoute - Korumalı sayfa wrapper bileşeni
 * 
 * Kullanıcının kimlik doğrulama durumunu ve yetki seviyesini kontrol eder.
 * Gerekli koşullar sağlanmazsa uygun sayfaya yönlendirir.
 * 
 * @example
 * ```tsx
 * // Sadece giriş yapmış kullanıcılar
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 * 
 * // Sadece admin ve üstü
 * <ProtectedRoute requiredRole="admin">
 *   <AdminPanel />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  requiredRole,
  loadingComponent,
  unauthorizedRedirect = '/unauthorized',
  loginRedirect = '/login',
  pendingRedirect = '/pending',
}: ProtectedRouteProps): React.ReactElement {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  // Yönlendirme durumunu belirle
  const redirectTo = React.useMemo(() => {
    if (isLoading) {
      return null;
    }
    
    // Giriş yapılmamış
    if (!isAuthenticated || !user) {
      return loginRedirect;
    }

    // Kullanıcı durumu kontrolü
    if (user.status === 'pending') {
      return pendingRedirect;
    }

    if (user.status === 'rejected') {
      return unauthorizedRedirect;
    }

    // Onaylı kullanıcı için yetki seviyesi kontrolü
    if (requiredRole && !hasRequiredRole(user.role || 'none', requiredRole)) {
      return unauthorizedRedirect;
    }

    return null; // Yönlendirme gerekmiyor
  }, [isLoading, isAuthenticated, user, requiredRole, loginRedirect, pendingRedirect, unauthorizedRedirect]);

  // useEffect ile yönlendirme yap
  useEffect(() => {
    if (redirectTo) {
      router.replace(redirectTo as never);
    }
  }, [redirectTo, router]);

  // Yükleme durumu veya yönlendirme bekleniyorsa loading göster
  if (isLoading || redirectTo) {
    return <>{loadingComponent || <DefaultLoadingComponent />}</>;
  }

  // Tüm kontroller geçti, içeriği göster
  return <>{children}</>;
}

export default ProtectedRoute;
