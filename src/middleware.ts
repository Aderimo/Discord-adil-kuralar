// Next.js Middleware - RBAC tabanlı rota koruması ve loglama entegrasyonu
// Requirement 2.1: Onaylanmamış veya yetkisiz kullanıcılar sadece engelleme mesajını görmeli
// Requirement 2.2: Onaylı yetkili yetki seviyesine göre uygun içeriği görmeli
// Requirement 2.3: "Beklemede" durumundaki kullanıcılar ana içeriğe erişememeli
// Requirement 2.4: Her sayfa isteğinde kullanıcının yetki durumunu doğrulamalı
// Requirement 9.1: Tüm giriş işlemlerini loglamalı (kullanıcı, zaman, IP)
// Requirement 9.2: İçerik erişimlerini loglamalı (kim neyi okudu)
// Requirement 9.4: Yetkisiz erişim denemelerini loglamalı

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { 
  ROLE_HIERARCHY, 
  type AccessDeniedReason 
} from './lib/rbac';
import type { UserRole, UserStatus } from './types';

/**
 * Request'ten IP adresini çıkarır
 * X-Forwarded-For, X-Real-IP veya connection remote address kullanır
 */
function getClientIP(request: NextRequest): string {
  // X-Forwarded-For header'ı (proxy arkasında)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // İlk IP adresi gerçek client IP'sidir
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips[0]) {
      return ips[0];
    }
  }

  // X-Real-IP header'ı (nginx gibi reverse proxy'ler)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Varsayılan olarak bilinmeyen
  return 'unknown';
}

/**
 * Log verisi yapısı - internal API'ye gönderilecek
 */
interface LogData {
  userId: string | undefined;
  ipAddress: string;
  path: string;
  method: string;
  userAgent: string | undefined;
  action: 'api_request' | 'page_request' | 'unauthorized_access';
  reason?: string;
  timestamp: string;
}

/**
 * Middleware'de kullanılacak basitleştirilmiş kullanıcı tipi
 * (Prisma middleware'de kullanılamaz, bu yüzden JWT payload'dan alıyoruz)
 */
interface MiddlewareUser {
  id: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * JWT payload'dan kullanıcı bilgisi çıkarır
 * Not: Middleware edge runtime'da çalıştığı için Prisma kullanamıyoruz
 * Bu yüzden JWT'ye kullanıcı bilgilerini eklememiz gerekiyor
 */
function getUserFromJWT(token: string): MiddlewareUser | null {
  try {
    // JWT payload'dan kullanıcı bilgilerini al (verify yapmadan sadece decode)
    // Edge runtime'da jsonwebtoken çalışmıyor, bu yüzden manuel decode
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      // Invalid JWT format - silently fail
      return null;
    }
    
    // Base64 decode - edge runtime uyumlu
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    // Token süresi dolmuş mu kontrol et
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      // Token expired - silently fail
      return null;
    }

    const user = {
      id: payload.userId,
      role: (payload.role || 'none') as UserRole,
      status: (payload.status || 'pending') as UserStatus,
    };
    
    return user;
  } catch {
    // JWT decode error - silently fail
    return null;
  }
}

/**
 * Rol kontrolü yapar
 */
function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Rota koruma kuralları
 */
interface RouteRule {
  pattern: RegExp;
  isPublic?: boolean;
  redirectIfAuthenticated?: string;
  allowedStatuses?: UserStatus[];
  requiredRole?: UserRole;
}

const ROUTE_RULES: RouteRule[] = [
  // Statik dosyalar ve API - middleware atla
  { pattern: /^\/_next\//, isPublic: true },
  { pattern: /^\/api\//, isPublic: true },
  { pattern: /^\/favicon\.ico$/, isPublic: true },
  { pattern: /^\/_vercel\//, isPublic: true },
  { pattern: /\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2|ttf|eot)$/, isPublic: true },
  
  // Auth sayfaları - giriş yapmış kullanıcıları yönlendir
  { pattern: /^\/login$/, isPublic: true, redirectIfAuthenticated: '/' },
  { pattern: /^\/register$/, isPublic: true, redirectIfAuthenticated: '/' },
  
  // Yetkisiz erişim sayfası - herkese açık
  { pattern: /^\/unauthorized$/, isPublic: true },
  
  // Beklemede sayfası - sadece pending kullanıcılar
  { pattern: /^\/pending$/, allowedStatuses: ['pending'] },
  
  // Admin rotaları - admin ve üstü
  { pattern: /^\/admin(\/.*)?$/, requiredRole: 'admin' },
];

/**
 * Rota için kural bulur
 */
function findRouteRule(pathname: string): RouteRule | null {
  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(pathname)) {
      return rule;
    }
  }
  return null;
}

/**
 * Erişim kontrolü sonucu
 */
interface AccessResult {
  allowed: boolean;
  redirect?: string;
  reason?: AccessDeniedReason | 'redirect_authenticated';
}

/**
 * Rota erişim kontrolü
 */
function checkAccess(pathname: string, user: MiddlewareUser | null): AccessResult {
  const rule = findRouteRule(pathname);

  // Kural bulunamadı - varsayılan olarak mod+ ve approved gerekli
  if (!rule) {
    if (!user) {
      return { allowed: false, redirect: '/login', reason: 'not_authenticated' };
    }
    if (user.status === 'pending') {
      return { allowed: false, redirect: '/pending', reason: 'pending_approval' };
    }
    if (user.status === 'rejected') {
      return { allowed: false, redirect: '/unauthorized', reason: 'rejected' };
    }
    if (user.role === 'none') {
      return { allowed: false, redirect: '/unauthorized', reason: 'no_role' };
    }
    if (!hasRole(user.role, 'mod')) {
      return { allowed: false, redirect: '/unauthorized', reason: 'insufficient_role' };
    }
    return { allowed: true };
  }

  // Public rota
  if (rule.isPublic) {
    // Giriş yapmış onaylı kullanıcıları yönlendir
    if (rule.redirectIfAuthenticated && user && user.status === 'approved') {
      return { 
        allowed: false, 
        redirect: rule.redirectIfAuthenticated, 
        reason: 'redirect_authenticated' 
      };
    }
    return { allowed: true };
  }

  // Kullanıcı giriş yapmamış
  if (!user) {
    return { allowed: false, redirect: '/login', reason: 'not_authenticated' };
  }

  // Belirli durumlar için izin verilen rotalar
  if (rule.allowedStatuses) {
    if (rule.allowedStatuses.includes(user.status)) {
      return { allowed: true };
    }
    // Durum uyuşmuyor
    if (user.status === 'approved') {
      return { allowed: false, redirect: '/' };
    }
    if (user.status === 'rejected') {
      return { allowed: false, redirect: '/unauthorized' };
    }
    return { allowed: false, redirect: '/login' };
  }

  // Durum kontrolü
  if (user.status === 'pending') {
    return { allowed: false, redirect: '/pending', reason: 'pending_approval' };
  }
  if (user.status === 'rejected') {
    return { allowed: false, redirect: '/unauthorized', reason: 'rejected' };
  }

  // Rol kontrolü
  const requiredRole = rule.requiredRole || 'mod';
  if (user.role === 'none') {
    return { allowed: false, redirect: '/unauthorized', reason: 'no_role' };
  }
  if (!hasRole(user.role, requiredRole)) {
    return { allowed: false, redirect: '/unauthorized', reason: 'insufficient_role' };
  }

  return { allowed: true };
}

/**
 * Next.js Middleware
 * Her API isteğinde otomatik loglama ve kullanıcı aktivite takibi
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // IP adresini al
  const ipAddress = getClientIP(request);
  
  // User-Agent bilgisini al
  const userAgent = request.headers.get('user-agent') || undefined;

  // Token'ı al
  const token = request.cookies.get('auth_token')?.value;
  
  // Kullanıcı bilgisini JWT'den çıkar
  let user: MiddlewareUser | null = null;
  if (token) {
    user = getUserFromJWT(token);
  }

  // Erişim kontrolü
  const access = checkAccess(pathname, user);

  // Log verisi hazırla
  const logData: LogData = {
    userId: user?.id,
    ipAddress,
    path: pathname,
    method,
    userAgent,
    action: pathname.startsWith('/api/') ? 'api_request' : 'page_request',
    timestamp: new Date().toISOString(),
  };

  // Erişim izni var
  if (access.allowed) {
    // Response'a log bilgilerini header olarak ekle
    // API route'lar bu bilgileri kullanarak loglama yapabilir
    const response = NextResponse.next();
    
    // Log bilgilerini header'lara ekle (API route'lar için)
    response.headers.set('x-log-user-id', user?.id || '');
    response.headers.set('x-log-ip-address', ipAddress);
    response.headers.set('x-log-path', pathname);
    response.headers.set('x-log-method', method);
    response.headers.set('x-log-timestamp', logData.timestamp);
    if (userAgent) {
      response.headers.set('x-log-user-agent', userAgent.substring(0, 200));
    }
    
    // API istekleri için asenkron loglama (fire-and-forget)
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/logs')) {
      // Internal log API'sine gönder (non-blocking)
      sendLogAsync(request, logData).catch(() => {
        // Loglama hatası sessizce yoksay
      });
    }
    
    return response;
  }

  // Yetkisiz erişim denemesi - logla
  logData.action = 'unauthorized_access';
  logData.reason = access.reason || 'unknown';
  
  // Yetkisiz erişim logunu gönder (non-blocking)
  sendLogAsync(request, logData).catch(() => {
    // Loglama hatası sessizce yoksay
  });

  // Yönlendirme gerekli
  if (access.redirect) {
    const url = request.nextUrl.clone();
    url.pathname = access.redirect;
    
    // Sonsuz döngüyü önle
    if (url.pathname === pathname) {
      return NextResponse.next();
    }
    
    return NextResponse.redirect(url);
  }

  // Varsayılan - unauthorized'a yönlendir
  const url = request.nextUrl.clone();
  url.pathname = '/unauthorized';
  return NextResponse.redirect(url);
}

/**
 * Asenkron log gönderimi - middleware'i bloklamaz
 * Internal API endpoint'e log verisi gönderir
 */
async function sendLogAsync(request: NextRequest, logData: LogData): Promise<void> {
  try {
    // Internal log API URL'ini oluştur
    const logUrl = new URL('/api/logs/internal', request.nextUrl.origin);
    
    // Log verisini gönder (fire-and-forget)
    await fetch(logUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true', // Internal request marker
      },
      body: JSON.stringify(logData),
    });
  } catch {
    // Loglama hatası sessizce yoksay - middleware'i etkilememeli
  }
}

/**
 * Middleware config - hangi rotalar için çalışacağını belirler
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
