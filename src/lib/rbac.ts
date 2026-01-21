// RBAC (Role-Based Access Control) - Rol tabanlı erişim kontrolü
// Requirement 2.1: Onaylanmamış veya yetkisiz kullanıcılar sadece engelleme mesajını görmeli
// Requirement 2.2: Onaylı yetkili yetki seviyesine göre uygun içeriği görmeli
// Requirement 2.3: "Beklemede" durumundaki kullanıcılar ana içeriğe erişememeli
// Requirement 2.4: Her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı

import type { UserRole, UserStatus, User } from '@/types';

/**
 * Yetki seviyesi hiyerarşisi
 * Daha yüksek sayı = daha yüksek yetki
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  none: 0,
  mod: 1,
  admin: 2,
  ust_yetkili: 3,
} as const;

/**
 * Kullanıcının belirli bir role sahip olup olmadığını kontrol eder
 * Hiyerarşik kontrol yapar - üst roller alt rollerin yetkilerine sahiptir
 * 
 * @param userRole - Kullanıcının mevcut rolü
 * @param requiredRole - Gerekli minimum rol
 * @returns Kullanıcının gerekli role sahip olup olmadığı
 * 
 * @example
 * hasRole('admin', 'mod') // true - admin, mod yetkisine sahip
 * hasRole('mod', 'admin') // false - mod, admin yetkisine sahip değil
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Kullanıcının bir kaynağa erişip erişemeyeceğini kontrol eder
 * Hem durum (status) hem de rol kontrolü yapar
 * 
 * @param user - Kullanıcı objesi (null olabilir)
 * @param requiredRole - Gerekli minimum rol (varsayılan: 'mod')
 * @returns Erişim izni sonucu
 * 
 * @example
 * canAccess(user, 'admin') // { allowed: true/false, reason: '...' }
 */
export function canAccess(
  user: User | null,
  requiredRole: UserRole = 'mod'
): { allowed: boolean; reason: AccessDeniedReason | null } {
  // Kullanıcı yok - giriş yapılmamış
  if (!user) {
    return { allowed: false, reason: 'not_authenticated' };
  }

  // Kullanıcı durumu kontrolü
  if (user.status === 'pending') {
    return { allowed: false, reason: 'pending_approval' };
  }

  if (user.status === 'rejected') {
    return { allowed: false, reason: 'rejected' };
  }

  // Onaylı kullanıcı için rol kontrolü
  if (user.status === 'approved') {
    // Rol 'none' ise erişim yok
    if (user.role === 'none') {
      return { allowed: false, reason: 'no_role' };
    }

    // Gerekli role sahip mi?
    if (!hasRole(user.role, requiredRole)) {
      return { allowed: false, reason: 'insufficient_role' };
    }

    // Tüm kontroller geçti
    return { allowed: true, reason: null };
  }

  // Bilinmeyen durum - güvenlik için reddet
  return { allowed: false, reason: 'unknown_status' };
}

/**
 * Erişim reddedilme nedenleri
 */
export type AccessDeniedReason =
  | 'not_authenticated'
  | 'pending_approval'
  | 'rejected'
  | 'no_role'
  | 'insufficient_role'
  | 'unknown_status';

/**
 * Erişim reddedilme nedenine göre yönlendirme URL'i döndürür
 */
export function getRedirectUrl(reason: AccessDeniedReason): string {
  switch (reason) {
    case 'not_authenticated':
      return '/login';
    case 'pending_approval':
      return '/pending';
    case 'rejected':
    case 'no_role':
    case 'insufficient_role':
    case 'unknown_status':
    default:
      return '/unauthorized';
  }
}

/**
 * Erişim reddedilme nedenine göre hata mesajı döndürür
 */
export function getAccessDeniedMessage(reason: AccessDeniedReason): string {
  switch (reason) {
    case 'not_authenticated':
      return 'Lütfen giriş yapın';
    case 'pending_approval':
      return 'Hesabınız henüz onaylanmadı';
    case 'rejected':
      return 'Hesabınız reddedildi';
    case 'no_role':
      return 'Yetki seviyeniz atanmamış';
    case 'insufficient_role':
      return 'Bu işlem için yetkiniz bulunmamaktadır';
    case 'unknown_status':
    default:
      return 'Erişim reddedildi';
  }
}

/**
 * Rota koruma kuralları
 */
export interface RouteProtection {
  /** Rota pattern'i (regex veya string) */
  pattern: string | RegExp;
  /** Gerekli minimum rol (undefined = sadece giriş gerekli) */
  requiredRole?: UserRole;
  /** Public rota mı? (giriş gerektirmez) */
  isPublic?: boolean;
  /** Giriş yapmış kullanıcıları yönlendir */
  redirectIfAuthenticated?: string;
  /** Sadece belirli durumlar için */
  allowedStatuses?: UserStatus[];
}

/**
 * Varsayılan rota koruma kuralları
 */
export const DEFAULT_ROUTE_RULES: RouteProtection[] = [
  // Public rotalar - giriş yapmış kullanıcıları ana sayfaya yönlendir
  { pattern: '/login', isPublic: true, redirectIfAuthenticated: '/' },
  { pattern: '/register', isPublic: true, redirectIfAuthenticated: '/' },
  
  // Yetkisiz erişim sayfası - herkese açık
  { pattern: '/unauthorized', isPublic: true },
  
  // Beklemede sayfası - sadece pending kullanıcılar için
  { pattern: '/pending', isPublic: false, allowedStatuses: ['pending'] },
  
  // Admin rotaları - sadece admin ve üstü
  { pattern: /^\/admin(\/.*)?$/, requiredRole: 'admin' },
  
  // API rotaları - middleware tarafından işlenmez (API kendi auth'unu yapar)
  { pattern: /^\/api\//, isPublic: true },
  
  // Statik dosyalar
  { pattern: /^\/_next\//, isPublic: true },
  { pattern: /^\/favicon\.ico$/, isPublic: true },
  
  // Diğer tüm rotalar - onaylı mod+ kullanıcılar için
  // Bu kural en sonda olmalı (catch-all)
];

/**
 * Bir rota için koruma kuralını bulur
 */
export function findRouteRule(pathname: string): RouteProtection | null {
  for (const rule of DEFAULT_ROUTE_RULES) {
    if (typeof rule.pattern === 'string') {
      if (pathname === rule.pattern) {
        return rule;
      }
    } else if (rule.pattern instanceof RegExp) {
      if (rule.pattern.test(pathname)) {
        return rule;
      }
    }
  }
  return null;
}

/**
 * Rota erişim kontrolü sonucu
 */
export interface RouteAccessResult {
  allowed: boolean;
  redirect?: string;
  reason?: AccessDeniedReason | 'redirect_authenticated';
}

/**
 * Bir rota için erişim kontrolü yapar
 */
export function checkRouteAccess(
  pathname: string,
  user: User | null
): RouteAccessResult {
  const rule = findRouteRule(pathname);

  // Kural bulunamadı - varsayılan olarak mod+ gerekli
  if (!rule) {
    const access = canAccess(user, 'mod');
    if (!access.allowed && access.reason) {
      return {
        allowed: false,
        redirect: getRedirectUrl(access.reason),
        reason: access.reason,
      };
    }
    return { allowed: true };
  }

  // Public rota
  if (rule.isPublic) {
    // Giriş yapmış kullanıcıları yönlendir
    if (rule.redirectIfAuthenticated && user && user.status === 'approved') {
      return {
        allowed: false,
        redirect: rule.redirectIfAuthenticated,
        reason: 'redirect_authenticated',
      };
    }
    return { allowed: true };
  }

  // Kullanıcı giriş yapmamış
  if (!user) {
    return {
      allowed: false,
      redirect: '/login',
      reason: 'not_authenticated',
    };
  }

  // Belirli durumlar için izin verilen rotalar (örn: /pending)
  if (rule.allowedStatuses) {
    if (rule.allowedStatuses.includes(user.status)) {
      return { allowed: true };
    }
    // Durum uyuşmuyor - uygun sayfaya yönlendir
    if (user.status === 'approved') {
      return { allowed: false, redirect: '/' };
    }
    if (user.status === 'rejected') {
      return { allowed: false, redirect: '/unauthorized' };
    }
    return { allowed: false, redirect: '/login' };
  }

  // Standart erişim kontrolü
  const requiredRole = rule.requiredRole || 'mod';
  const access = canAccess(user, requiredRole);
  
  if (!access.allowed && access.reason) {
    return {
      allowed: false,
      redirect: getRedirectUrl(access.reason),
      reason: access.reason,
    };
  }

  return { allowed: true };
}
