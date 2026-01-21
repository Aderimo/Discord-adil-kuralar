// Logging Service - Aktivite loglama servisi
// Requirement 9.1: Tüm giriş işlemlerini loglamalı (kullanıcı, zaman, IP)
// Requirement 9.2: İçerik erişimlerini loglamalı (kim neyi okudu)
// Requirement 9.3: Yetki değişikliklerini loglamalı
// Requirement 9.4: Yetkisiz erişim denemelerini loglamalı

import { prisma } from './prisma';
import type { ActivityAction, ActivityLog, UserRole } from '@/types';
import { toAppActivityLog } from './db';

/**
 * Log filtreleme seçenekleri
 */
export interface LogFilters {
  userId?: string;
  action?: ActivityAction | ActivityAction[];
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Log sonuçları
 */
export interface LogResult {
  logs: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Genel aktivite log kaydı oluşturur
 * @param userId - Kullanıcı ID'si
 * @param action - Aktivite türü
 * @param details - Aktivite detayları
 * @param ipAddress - IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logActivity(
  userId: string,
  action: ActivityAction,
  details: Record<string, unknown>,
  ipAddress: string
): Promise<ActivityLog> {
  const log = await prisma.activityLog.create({
    data: {
      userId,
      action,
      details: JSON.stringify(details),
      ipAddress,
    },
  });

  return toAppActivityLog(log);
}

/**
 * Filtrelere göre aktivite loglarını getirir
 * @param filters - Filtreleme seçenekleri
 * @returns Log sonuçları
 */
export async function getActivityLogs(filters: LogFilters = {}): Promise<LogResult> {
  const {
    userId,
    action,
    startDate,
    endDate,
    ipAddress,
    page = 1,
    pageSize = 20,
  } = filters;

  // Where koşullarını oluştur
  const where: Record<string, unknown> = {};

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    if (Array.isArray(action)) {
      where.action = { in: action };
    } else {
      where.action = action;
    }
  }

  if (ipAddress) {
    where.ipAddress = ipAddress;
  }

  // Tarih aralığı filtresi
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) {
      (where.timestamp as Record<string, Date>).gte = startDate;
    }
    if (endDate) {
      (where.timestamp as Record<string, Date>).lte = endDate;
    }
  }

  // Toplam sayıyı al
  const total = await prisma.activityLog.count({ where });

  // Logları getir
  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: {
      timestamp: 'desc',
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    logs: logs.map(toAppActivityLog),
    total,
    page,
    pageSize,
  };
}

/**
 * Kullanıcı giriş logunu kaydeder
 * Requirement 9.1: Tüm giriş işlemlerini loglamalı
 * @param userId - Giriş yapan kullanıcı ID'si
 * @param ipAddress - IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logLogin(
  userId: string,
  ipAddress: string
): Promise<ActivityLog> {
  return logActivity(userId, 'login', {
    event: 'user_login',
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * Kullanıcı çıkış logunu kaydeder
 * @param userId - Çıkış yapan kullanıcı ID'si
 * @param ipAddress - IP adresi
 * @returns Oluşturulan log kaydı
 */
export async function logLogout(
  userId: string,
  ipAddress: string
): Promise<ActivityLog> {
  return logActivity(userId, 'logout', {
    event: 'user_logout',
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * İçerik erişim logunu kaydeder
 * Requirement 9.2: İçerik erişimlerini loglamalı (kim neyi okudu)
 * @param userId - Erişen kullanıcı ID'si
 * @param contentId - Erişilen içerik ID'si
 * @param ipAddress - IP adresi
 * @param contentType - İçerik türü (opsiyonel)
 * @param contentTitle - İçerik başlığı (opsiyonel)
 * @returns Oluşturulan log kaydı
 */
export async function logContentAccess(
  userId: string,
  contentId: string,
  ipAddress: string,
  contentType?: string,
  contentTitle?: string
): Promise<ActivityLog> {
  return logActivity(userId, 'view_content', {
    event: 'content_access',
    contentId,
    contentType,
    contentTitle,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * Arama logunu kaydeder
 * @param userId - Arama yapan kullanıcı ID'si
 * @param query - Arama sorgusu
 * @param ipAddress - IP adresi
 * @param resultsCount - Sonuç sayısı (opsiyonel)
 * @returns Oluşturulan log kaydı
 */
export async function logSearch(
  userId: string,
  query: string,
  ipAddress: string,
  resultsCount?: number
): Promise<ActivityLog> {
  return logActivity(userId, 'search', {
    event: 'search_query',
    query,
    resultsCount,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * AI sorgu logunu kaydeder
 * @param userId - Sorgu yapan kullanıcı ID'si
 * @param query - AI sorusu
 * @param ipAddress - IP adresi
 * @param confidence - Güven skoru (opsiyonel)
 * @returns Oluşturulan log kaydı
 */
export async function logAIQuery(
  userId: string,
  query: string,
  ipAddress: string,
  confidence?: 'high' | 'medium' | 'low'
): Promise<ActivityLog> {
  return logActivity(userId, 'ai_query', {
    event: 'ai_query',
    query: query.substring(0, 200), // Uzun sorguları kısalt
    confidence,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * Yetki değişikliği logunu kaydeder
 * Requirement 9.3: Yetki değişikliklerini loglamalı
 * @param adminId - İşlemi yapan admin ID'si
 * @param targetUserId - Yetkisi değiştirilen kullanıcı ID'si
 * @param oldRole - Eski yetki seviyesi
 * @param newRole - Yeni yetki seviyesi
 * @param ipAddress - IP adresi
 * @param targetUsername - Hedef kullanıcı adı (opsiyonel)
 * @returns Oluşturulan log kaydı
 */
export async function logRoleChange(
  adminId: string,
  targetUserId: string,
  oldRole: UserRole,
  newRole: UserRole,
  ipAddress: string,
  targetUsername?: string
): Promise<ActivityLog> {
  return logActivity(adminId, 'role_change', {
    event: 'role_change',
    targetUserId,
    targetUsername,
    previousRole: oldRole,
    newRole,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * Kullanıcı onaylama logunu kaydeder
 * @param adminId - Onaylayan admin ID'si
 * @param targetUserId - Onaylanan kullanıcı ID'si
 * @param assignedRole - Atanan yetki seviyesi
 * @param ipAddress - IP adresi
 * @param targetUsername - Hedef kullanıcı adı (opsiyonel)
 * @returns Oluşturulan log kaydı
 */
export async function logUserApprove(
  adminId: string,
  targetUserId: string,
  assignedRole: UserRole,
  ipAddress: string,
  targetUsername?: string
): Promise<ActivityLog> {
  return logActivity(adminId, 'user_approve', {
    event: 'user_approve',
    targetUserId,
    targetUsername,
    assignedRole,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * Kullanıcı reddetme logunu kaydeder
 * @param adminId - Reddeden admin ID'si
 * @param targetUserId - Reddedilen kullanıcı ID'si
 * @param ipAddress - IP adresi
 * @param targetUsername - Hedef kullanıcı adı (opsiyonel)
 * @param reason - Red sebebi (opsiyonel)
 * @returns Oluşturulan log kaydı
 */
export async function logUserReject(
  adminId: string,
  targetUserId: string,
  ipAddress: string,
  targetUsername?: string,
  reason?: string
): Promise<ActivityLog> {
  return logActivity(adminId, 'user_reject', {
    event: 'user_reject',
    targetUserId,
    targetUsername,
    reason,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * Yetkisiz erişim denemesi logunu kaydeder
 * Requirement 9.4: Yetkisiz erişim denemelerini loglamalı
 * @param ipAddress - IP adresi
 * @param attemptedPath - Erişilmeye çalışılan yol
 * @param userId - Kullanıcı ID'si (varsa)
 * @param reason - Erişim red sebebi (opsiyonel)
 * @returns Oluşturulan log kaydı veya null (kullanıcı yoksa)
 */
export async function logUnauthorizedAccess(
  ipAddress: string,
  attemptedPath: string,
  userId?: string,
  reason?: string
): Promise<ActivityLog | null> {
  // Yetkisiz erişim için sistem kullanıcısı veya mevcut kullanıcı kullan
  // Eğer userId yoksa, "system" kullanıcısı oluştur veya bul
  let logUserId = userId;

  if (!logUserId) {
    // Sistem kullanıcısını bul veya oluştur
    let systemUser = await prisma.user.findUnique({
      where: { email: 'system@yetkili-kilavuzu.local' },
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          username: 'system',
          email: 'system@yetkili-kilavuzu.local',
          passwordHash: 'SYSTEM_USER_NO_LOGIN',
          status: 'approved',
          role: 'none',
        },
      });
    }

    logUserId = systemUser.id;
  }

  // Yetkisiz erişim için özel bir action yok, view_content kullanıyoruz
  // ama details içinde unauthorized olduğunu belirtiyoruz
  return logActivity(logUserId, 'view_content', {
    event: 'unauthorized_access',
    attemptedPath,
    reason: reason || 'access_denied',
    unauthorized: true,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}

/**
 * Belirli bir kullanıcının son aktivitelerini getirir
 * @param userId - Kullanıcı ID'si
 * @param limit - Maksimum kayıt sayısı
 * @returns Aktivite logları
 */
export async function getUserRecentActivity(
  userId: string,
  limit: number = 10
): Promise<ActivityLog[]> {
  const logs = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return logs.map(toAppActivityLog);
}

/**
 * Belirli bir IP adresinin aktivitelerini getirir
 * @param ipAddress - IP adresi
 * @param limit - Maksimum kayıt sayısı
 * @returns Aktivite logları
 */
export async function getIPActivity(
  ipAddress: string,
  limit: number = 50
): Promise<ActivityLog[]> {
  const logs = await prisma.activityLog.findMany({
    where: { ipAddress },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return logs.map(toAppActivityLog);
}

/**
 * Belirli bir zaman aralığındaki giriş loglarını getirir
 * @param startDate - Başlangıç tarihi
 * @param endDate - Bitiş tarihi
 * @returns Giriş logları
 */
export async function getLoginLogs(
  startDate?: Date,
  endDate?: Date
): Promise<ActivityLog[]> {
  const where: Record<string, unknown> = {
    action: 'login',
  };

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) {
      (where.timestamp as Record<string, Date>).gte = startDate;
    }
    if (endDate) {
      (where.timestamp as Record<string, Date>).lte = endDate;
    }
  }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
  });

  return logs.map(toAppActivityLog);
}

/**
 * Yetkisiz erişim denemelerini getirir
 * @param limit - Maksimum kayıt sayısı
 * @returns Yetkisiz erişim logları
 */
export async function getUnauthorizedAccessLogs(
  limit: number = 100
): Promise<ActivityLog[]> {
  const logs = await prisma.activityLog.findMany({
    where: {
      details: {
        contains: '"unauthorized":true',
      },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return logs.map(toAppActivityLog);
}

/**
 * Yetki değişikliği loglarını getirir
 * @param limit - Maksimum kayıt sayısı
 * @returns Yetki değişikliği logları
 */
export async function getRoleChangeLogs(
  limit: number = 100
): Promise<ActivityLog[]> {
  const logs = await prisma.activityLog.findMany({
    where: {
      action: {
        in: ['role_change', 'user_approve', 'user_reject'],
      },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return logs.map(toAppActivityLog);
}

/**
 * İçerik değişikliği logunu kaydeder
 * Requirement 11.6: Tüm içerik değişikliklerini loglamalı (kim, ne zaman, ne değişti)
 * @param userId - İşlemi yapan kullanıcı ID'si
 * @param contentId - Değiştirilen içerik ID'si
 * @param action - İşlem türü (create, update, delete)
 * @param ipAddress - IP adresi
 * @param contentType - İçerik türü (guide, penalty, command, procedure)
 * @param contentTitle - İçerik başlığı
 * @param previousContent - Önceki içerik (güncelleme için)
 * @param newContent - Yeni içerik
 * @returns Oluşturulan log kaydı
 */
export async function logContentChange(
  userId: string,
  contentId: string,
  action: 'create' | 'update' | 'delete',
  ipAddress: string,
  contentType: string,
  contentTitle: string,
  previousContent?: Record<string, unknown>,
  newContent?: Record<string, unknown>
): Promise<ActivityLog> {
  return logActivity(userId, 'view_content', {
    event: 'content_change',
    contentId,
    contentType,
    contentTitle,
    changeType: action,
    previousContent: previousContent ? JSON.stringify(previousContent).substring(0, 1000) : undefined,
    newContent: newContent ? JSON.stringify(newContent).substring(0, 1000) : undefined,
    timestamp: new Date().toISOString(),
  }, ipAddress);
}
