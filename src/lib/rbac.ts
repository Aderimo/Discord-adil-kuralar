/**
 * RBAC (Role-Based Access Control) - Dinamik Rol Tabanlı Erişim Kontrolü
 *
 * Requirements:
 * - Requirement 2.1: Onaylanmamış veya yetkisiz kullanıcılar sadece engelleme mesajını görmeli
 * - Requirement 2.2: Onaylı yetkili yetki seviyesine göre uygun içeriği görmeli
 * - Requirement 2.3: "Beklemede" durumundaki kullanıcılar ana içeriğe erişememeli
 * - Requirement 2.4: Her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı
 * - Requirement 6.x: Dinamik rol yönetimi desteği
 */

import type { UserStatus, User, Role, Permission } from '@/types';
import { hasRolePermission, getRoleByCode } from '@/lib/roles';

/**
 * Eski tip uyumluluğu için UserRole
 * Artık dinamik olarak string kabul eder
 */
export type UserRole = string;

/**
 * Yetki seviyesi hiyerarşisi - Geriye dönük uyumluluk için
 * Dinamik sistemde veritabanından yüklenir
 *
 * @deprecated Dinamik rol sistemi kullanın: getRoleByCode()
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  none: 0,
  reg: 1,
  op: 2,
  gk: 3,
  council: 4,
  gm: 5,
  gm_plus: 6,
  owner: 7,
  // Eski rolleri de destekle (geriye uyumluluk)
  mod: 2,
  admin: 5,
  ust_yetkili: 7,
} as const;

/**
 * İzin tanımları - Geriye dönük uyumluluk için
 * Dinamik sistemde roller kendi izinlerini içerir
 *
 * @deprecated Dinamik rol sistemi kullanın: hasRolePermission()
 */
export const PERMISSIONS = {
  // Görüntüleme izinleri
  VIEW_CONTENT: ['reg', 'op', 'gk', 'council', 'gm', 'gm_plus', 'owner', 'mod', 'admin', 'ust_yetkili'] as const,
  VIEW_USERS: ['gk', 'council', 'gm', 'gm_plus', 'owner', 'admin', 'ust_yetkili'] as const,
  VIEW_LOGS: ['gm', 'gm_plus', 'owner', 'ust_yetkili'] as const,
  VIEW_NOTIFICATIONS: ['gk', 'council', 'gm', 'gm_plus', 'owner', 'admin', 'ust_yetkili'] as const,

  // Düzenleme izinleri
  EDIT_CONTENT: ['op', 'gk', 'council', 'gm', 'gm_plus', 'owner', 'admin', 'ust_yetkili'] as const,
  EDIT_USERS: ['council', 'gm', 'gm_plus', 'owner', 'admin', 'ust_yetkili'] as const,
  EDIT_TEMPLATES: ['gm_plus', 'owner', 'ust_yetkili'] as const,

  // Silme izinleri
  DELETE_CONTENT: ['gm_plus', 'owner', 'ust_yetkili'] as const,
  DELETE_USERS: ['owner', 'ust_yetkili'] as const,

  // Rol yönetimi
  MANAGE_ROLES: ['owner', 'ust_yetkili'] as const,
} as const;

/**
 * İzin tipi - export
 */
export type { Permission };

/**
 * Kullanıcının belirli bir izne sahip olup olmadığını kontrol eder
 * Dinamik rol verisini tercih eder, yoksa statik listeye bakar
 */
export function hasPermission(
  userRole: UserRole | null,
  permission: Permission,
  roleData?: Role | null
): boolean {
  // Rol yoksa izin yok
  if (!userRole) {
    return false;
  }

  // Dinamik rol verisi varsa onu kullan
  if (roleData) {
    return hasRolePermission(roleData, permission);
  }

  // Statik listeye geri dön (geriye uyumluluk)
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }
  return (allowedRoles as readonly string[]).includes(userRole);
}

/**
 * Kullanıcının belirli bir izne sahip olup olmadığını async olarak kontrol eder
 * Rol verisini veritabanından yükler
 */
export async function hasPermissionAsync(
  userRole: UserRole | null,
  permission: Permission
): Promise<boolean> {
  if (!userRole) {
    return false;
  }

  try {
    const role = await getRoleByCode(userRole);
    return hasRolePermission(role, permission);
  } catch {
    // Veritabanı hatası durumunda statik listeye geri dön
    return hasPermission(userRole, permission);
  }
}

/**
 * Kullanıcının belirli bir role sahip olup olmadığını kontrol eder
 * Hiyerarşik kontrol yapar - üst roller alt rollerin yetkilerine sahiptir
 */
export function hasRole(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) {
    return false;
  }

  const userHierarchy = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredHierarchy = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userHierarchy >= requiredHierarchy;
}

/**
 * Kullanıcının bir kaynağa erişip erişemeyeceğini kontrol eder
 * Hem durum (status) hem de rol kontrolü yapar
 */
export function canAccess(
  user: User | null,
  requiredRole: UserRole = 'reg'
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
    // Rol yoksa erişim yok
    if (!user.role) {
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
  { pattern: '/forgot-password', isPublic: true },
  { pattern: '/reset-password', isPublic: true },

  // Yetkisiz erişim sayfası - herkese açık
  { pattern: '/unauthorized', isPublic: true },

  // Beklemede sayfası - sadece pending kullanıcılar için
  { pattern: '/pending', isPublic: false, allowedStatuses: ['pending'] },

  // Admin rotaları - gm ve üstü
  { pattern: /^\/admin\/settings(\/.*)?$/, requiredRole: 'owner' }, // Rol yönetimi sadece owner
  { pattern: /^\/admin\/logs(\/.*)?$/, requiredRole: 'gm' }, // Log görüntüleme gm+
  { pattern: /^\/admin(\/.*)?$/, requiredRole: 'gk' }, // Diğer admin işlemleri gk+

  // API rotaları - middleware tarafından işlenmez (API kendi auth'unu yapar)
  { pattern: /^\/api\//, isPublic: true },

  // Statik dosyalar
  { pattern: /^\/_next\//, isPublic: true },
  { pattern: /^\/favicon\.ico$/, isPublic: true },

  // Diğer tüm rotalar - onaylı reg+ kullanıcılar için
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

  // Kural bulunamadı - varsayılan olarak reg+ gerekli
  if (!rule) {
    const access = canAccess(user, 'reg');
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
  const requiredRole = rule.requiredRole || 'reg';
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

/**
 * Rol adını kullanıcı dostu formata çevirir
 */
export function getRoleDisplayName(roleCode: string | null): string {
  if (!roleCode) return 'Rol Yok';

  const roleNames: Record<string, string> = {
    reg: 'Regülatör',
    op: 'Operatör',
    gk: 'GateKeeper',
    council: 'Council',
    gm: 'GM',
    gm_plus: '🔖 GM+',
    owner: 'Owner',
    // Eski roller
    none: 'Rol Yok',
    mod: 'Moderatör',
    admin: 'Admin',
    ust_yetkili: 'Üst Yetkili',
  };

  return roleNames[roleCode] || roleCode;
}

/**
 * Rol kısa adını döndürür
 */
export function getRoleShortName(roleCode: string | null): string {
  if (!roleCode) return '-';

  const shortNames: Record<string, string> = {
    reg: 'REG',
    op: 'OP',
    gk: 'GK',
    council: 'COUNCIL',
    gm: 'GM',
    gm_plus: 'GM+',
    owner: 'OWNER',
    // Eski roller
    none: '-',
    mod: 'MOD',
    admin: 'ADMIN',
    ust_yetkili: 'ÜST',
  };

  return shortNames[roleCode] || roleCode.toUpperCase();
}
