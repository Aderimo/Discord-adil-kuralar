// RBAC (Role-Based Access Control) - Rol tabanlı erişim kontrolü

import type { UserRole, UserStatus, User } from '@/types';

/**
 * Yetki seviyesi hiyerarşisi
 * Daha yüksek sayı = daha yüksek yetki
 *
 * Sıralama (düşükten yükseğe):
 * none < reg < op < gatekeeper < council < gm < ust_yetkili < owner
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  none: 0,
  reg: 1,           // Regulatör
  op: 2,            // Operatör
  gatekeeper: 3,    // GateKeeper
  council: 4,       // Council
  gm: 5,            // GM (General Manager)
  ust_yetkili: 10,  // Üst Yetkili
  owner: 11,        // Owner (en yüksek - sadece owner)
} as const;

/**
 * İzin tanımları - her izin için gerekli minimum rol
 *
 * VIEW_CONTENT:       reg+         (tüm yetkililer)
 * VIEW_USERS:         council+     (yönetim kadrosu)
 * VIEW_LOGS:          owner        (sadece owner)
 * VIEW_NOTIFICATIONS: ust_yetkili+ (üst yetkililer)
 * EDIT_CONTENT:       gm+          (GM ve üstü)
 * EDIT_USERS:         ust_yetkili+ (üst yetkililer)
 * EDIT_TEMPLATES:     owner        (sadece owner)
 * DELETE_CONTENT:     owner        (sadece owner)
 * DELETE_USERS:       owner        (sadece owner)
 */
export const PERMISSIONS: Record<string, UserRole> = {
  VIEW_CONTENT: 'reg',
  VIEW_USERS: 'council',
  VIEW_LOGS: 'owner',
  VIEW_NOTIFICATIONS: 'ust_yetkili',
  EDIT_CONTENT: 'gm',
  EDIT_USERS: 'ust_yetkili',
  EDIT_TEMPLATES: 'owner',
  DELETE_CONTENT: 'owner',
  DELETE_USERS: 'owner',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Kullanıcının belirli bir izne sahip olup olmadığını kontrol eder
 * Hiyerarşik kontrol yapar - üst roller alt rollerin yetkilerine sahiptir
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const minRole = PERMISSIONS[permission] as UserRole;
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

/**
 * Kullanıcının belirli bir role sahip olup olmadığını kontrol eder
 * Hiyerarşik kontrol yapar
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

/**
 * Kullanıcının bir kaynağa erişip erişemeyeceğini kontrol eder
 */
export function canAccess(
  user: User | null,
  requiredRole: UserRole = 'reg'
): { allowed: boolean; reason: AccessDeniedReason | null } {
  if (!user) {
    return { allowed: false, reason: 'not_authenticated' };
  }

  if (user.status === 'pending') {
    return { allowed: false, reason: 'pending_approval' };
  }

  if (user.status === 'rejected') {
    return { allowed: false, reason: 'rejected' };
  }

  if (user.status === 'approved') {
    if (user.role === 'none') {
      return { allowed: false, reason: 'no_role' };
    }

    if (!hasRole(user.role, requiredRole)) {
      return { allowed: false, reason: 'insufficient_role' };
    }

    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'unknown_status' };
}

export type AccessDeniedReason =
  | 'not_authenticated'
  | 'pending_approval'
  | 'rejected'
  | 'no_role'
  | 'insufficient_role'
  | 'unknown_status';

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

export interface RouteProtection {
  pattern: string | RegExp;
  requiredRole?: UserRole;
  isPublic?: boolean;
  redirectIfAuthenticated?: string;
  allowedStatuses?: UserStatus[];
}

export const DEFAULT_ROUTE_RULES: RouteProtection[] = [
  { pattern: '/login', isPublic: true, redirectIfAuthenticated: '/' },
  { pattern: '/register', isPublic: true, redirectIfAuthenticated: '/' },
  { pattern: '/unauthorized', isPublic: true },
  { pattern: '/pending', isPublic: false, allowedStatuses: ['pending'] },
  { pattern: /^\/admin(\/.*)?$/, requiredRole: 'ust_yetkili' },
  { pattern: /^\/api\//, isPublic: true },
  { pattern: /^\/_next\//, isPublic: true },
  { pattern: /^\/favicon\.ico$/, isPublic: true },
];

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

export interface RouteAccessResult {
  allowed: boolean;
  redirect?: string;
  reason?: AccessDeniedReason | 'redirect_authenticated';
}

export function checkRouteAccess(
  pathname: string,
  user: User | null
): RouteAccessResult {
  const rule = findRouteRule(pathname);

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

  if (rule.isPublic) {
    if (rule.redirectIfAuthenticated && user && user.status === 'approved' && user.role !== 'none') {
      return {
        allowed: false,
        redirect: rule.redirectIfAuthenticated,
        reason: 'redirect_authenticated',
      };
    }
    return { allowed: true };
  }

  if (!user) {
    return { allowed: false, redirect: '/login', reason: 'not_authenticated' };
  }

  if (rule.allowedStatuses) {
    if (rule.allowedStatuses.includes(user.status)) {
      return { allowed: true };
    }
    if (user.status === 'approved') {
      return { allowed: false, redirect: '/' };
    }
    if (user.status === 'rejected') {
      return { allowed: false, redirect: '/unauthorized' };
    }
    return { allowed: false, redirect: '/login' };
  }

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
