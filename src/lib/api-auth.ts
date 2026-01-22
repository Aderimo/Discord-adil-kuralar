// API Auth Middleware - API rotaları için kimlik doğrulama ve yetkilendirme
// Requirement 2.4: Her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from './auth';
import { canAccess, getAccessDeniedMessage } from './rbac';
import type { User, UserRole } from '@/types';

/**
 * API handler tipi
 */
export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse<T>>;

/**
 * Authenticated API handler tipi - user parametresi eklenir
 */
export type AuthenticatedApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Record<string, string>; user: User }
) => Promise<NextResponse<T>>;

/**
 * withAuth options
 */
export interface WithAuthOptions {
  /** Gerekli minimum rol (varsayılan: 'reg') */
  requiredRole?: UserRole;
  /** Sadece onaylı kullanıcılar mı? (varsayılan: true) */
  requireApproved?: boolean;
}

/**
 * API hata yanıtı oluşturur
 */
function createErrorResponse(
  message: string,
  status: number,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    { status }
  );
}

/**
 * Request'ten auth token'ı çıkarır
 * Cookie veya Authorization header'dan alır
 */
export function extractToken(request: NextRequest): string | null {
  // Önce cookie'den dene
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // Authorization header'dan dene
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * API handler'ı kimlik doğrulama ile sarar
 * 
 * @param handler - API handler fonksiyonu
 * @param options - Yetkilendirme seçenekleri
 * @returns Sarılmış handler
 * 
 * @example
 * // Sadece giriş yapmış kullanıcılar
 * export const GET = withAuth(async (req, { user }) => {
 *   return NextResponse.json({ user });
 * });
 * 
 * // Sadece admin kullanıcılar
 * export const POST = withAuth(
 *   async (req, { user }) => {
 *     return NextResponse.json({ success: true });
 *   },
 *   { requiredRole: 'admin' }
 * );
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedApiHandler<T>,
  options: WithAuthOptions = {}
): ApiHandler<T> {
  const { requiredRole = 'reg', requireApproved = true } = options;

  return async (request: NextRequest, context: { params: Record<string, string> }) => {
    // Token'ı çıkar
    const token = extractToken(request);
    
    if (!token) {
      return createErrorResponse(
        'Kimlik doğrulama gerekli',
        401,
        'AUTH_REQUIRED'
      ) as NextResponse<T>;
    }

    // Kullanıcıyı getir
    const user = await getUserFromToken(token);
    
    if (!user) {
      return createErrorResponse(
        'Geçersiz veya süresi dolmuş oturum',
        401,
        'INVALID_SESSION'
      ) as NextResponse<T>;
    }

    // Erişim kontrolü
    if (requireApproved) {
      const access = canAccess(user, requiredRole);
      
      if (!access.allowed) {
        const message = access.reason 
          ? getAccessDeniedMessage(access.reason)
          : 'Erişim reddedildi';
        
        const status = access.reason === 'not_authenticated' ? 401 : 403;
        
        return createErrorResponse(
          message,
          status,
          access.reason?.toUpperCase()
        ) as NextResponse<T>;
      }
    }

    // Handler'ı çağır
    return handler(request, { ...context, user });
  };
}

/**
 * Belirli bir rol gerektiren API handler wrapper'ı
 * withAuth'un kısayolu
 * 
 * @example
 * export const GET = withRole('admin', async (req, { user }) => {
 *   return NextResponse.json({ adminData: true });
 * });
 */
export function withRole<T = unknown>(
  requiredRole: UserRole,
  handler: AuthenticatedApiHandler<T>
): ApiHandler<T> {
  return withAuth(handler, { requiredRole });
}

/**
 * Sadece admin ve üstü için API handler wrapper'ı
 */
export function withAdmin<T = unknown>(
  handler: AuthenticatedApiHandler<T>
): ApiHandler<T> {
  return withRole('admin', handler);
}

/**
 * Sadece üst yetkili için API handler wrapper'ı
 */
export function withSuperAdmin<T = unknown>(
  handler: AuthenticatedApiHandler<T>
): ApiHandler<T> {
  return withRole('ust_yetkili', handler);
}

/**
 * Opsiyonel kimlik doğrulama - kullanıcı varsa ekler, yoksa null
 */
export function withOptionalAuth<T = unknown>(
  handler: (
    request: NextRequest,
    context: { params: Record<string, string>; user: User | null }
  ) => Promise<NextResponse<T>>
): ApiHandler<T> {
  return async (request: NextRequest, context: { params: Record<string, string> }) => {
    const token = extractToken(request);
    let user: User | null = null;

    if (token) {
      user = await getUserFromToken(token);
    }

    return handler(request, { ...context, user });
  };
}

/**
 * Kimlik doğrulama sonucu
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Request'ten kullanıcı bilgisini çıkarır
 * API route'larda doğrudan kullanılabilir
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  const token = extractToken(request);
  
  if (!token) {
    return {
      success: false,
      error: 'Kimlik doğrulama gerekli',
    };
  }

  const user = await getUserFromToken(token);
  
  if (!user) {
    return {
      success: false,
      error: 'Geçersiz veya süresi dolmuş oturum',
    };
  }

  return {
    success: true,
    user,
  };
}
