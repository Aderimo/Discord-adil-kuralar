// Internal Log API - Middleware'den gelen log verilerini işler
// Bu endpoint sadece internal istekler için kullanılır
// Requirement 9.1: Tüm giriş işlemlerini loglamalı (kullanıcı, zaman, IP)
// Requirement 9.2: İçerik erişimlerini loglamalı (kim neyi okudu)
// Requirement 9.4: Yetkisiz erişim denemelerini loglamalı

import { NextRequest, NextResponse } from 'next/server';
import { logActivity, logUnauthorizedAccess } from '@/lib/logging';
import type { ActivityAction } from '@/types';

/**
 * Middleware'den gelen log verisi yapısı
 */
interface InternalLogData {
  userId?: string;
  ipAddress: string;
  path: string;
  method: string;
  userAgent?: string;
  action: 'api_request' | 'page_request' | 'unauthorized_access';
  reason?: string;
  timestamp: string;
}

/**
 * Path'e göre aktivite türünü belirle
 */
function determineActivityAction(path: string, _method: string): ActivityAction {
  // Auth işlemleri
  if (path.startsWith('/api/auth/login')) {
    return 'login';
  }
  if (path.startsWith('/api/auth/logout')) {
    return 'logout';
  }
  
  // AI sorguları
  if (path.startsWith('/api/ai/')) {
    return 'ai_query';
  }
  
  // Arama
  if (path.startsWith('/api/search')) {
    return 'search';
  }
  
  // Admin işlemleri
  if (path.includes('/approve')) {
    return 'user_approve';
  }
  if (path.includes('/reject')) {
    return 'user_reject';
  }
  if (path.includes('/role')) {
    return 'role_change';
  }
  
  // İçerik erişimi
  if (path.startsWith('/api/content') || !path.startsWith('/api/')) {
    return 'view_content';
  }
  
  // Varsayılan
  return 'view_content';
}

/**
 * POST /api/logs/internal
 * Middleware'den gelen log verilerini işler
 * Sadece internal istekler kabul edilir
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Internal request kontrolü
    const isInternal = request.headers.get('x-internal-request') === 'true';
    
    // Güvenlik: Sadece localhost veya internal istekleri kabul et
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    
    if (!isInternal && !isLocalhost) {
      // Production'da sadece internal istekleri kabul et
      // Development'ta localhost'tan gelen istekleri de kabul et
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    const data: InternalLogData = await request.json();

    // Yetkisiz erişim denemesi
    if (data.action === 'unauthorized_access') {
      await logUnauthorizedAccess(
        data.ipAddress,
        data.path,
        data.userId,
        data.reason
      );
      
      return NextResponse.json({ success: true, logged: 'unauthorized_access' });
    }

    // Normal aktivite logu
    if (data.userId) {
      const activityAction = determineActivityAction(data.path, data.method);
      
      await logActivity(
        data.userId,
        activityAction,
        {
          event: data.action,
          path: data.path,
          method: data.method,
          userAgent: data.userAgent,
          timestamp: data.timestamp,
        },
        data.ipAddress
      );
      
      return NextResponse.json({ success: true, logged: activityAction });
    }

    // Kullanıcı olmadan log (anonim erişim)
    return NextResponse.json({ success: true, logged: 'skipped_no_user' });
  } catch (error) {
    // Loglama hatası - sessizce yoksay
    console.error('Internal log error:', error);
    return NextResponse.json(
      { success: false, error: 'Log failed' },
      { status: 500 }
    );
  }
}
