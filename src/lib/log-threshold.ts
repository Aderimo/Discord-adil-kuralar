// Log Threshold Monitor Service - Log birikimi izleme ve bildirim servisi
// Requirement 6.1: WHEN the log count reaches 50 pages (1000 entries) THEN THE Notification_System SHALL send a notification to the Owner
// Requirement 6.2: WHEN sending log accumulation notification THEN THE Notification_System SHALL include the message "Log geçmişi 50 sayfa oldu"
// Requirement 6.3: WHEN the notification is sent THEN THE Notification_System SHALL grant Download_Permission to the Owner
// Requirement 6.4: THE Notification_System SHALL send only one notification per 50-page threshold
// Requirement 6.5: IF the Owner has not downloaded logs from previous notification THEN THE Notification_System SHALL not send duplicate notifications

import { prisma } from './prisma';
import { createNotification } from './notifications';

// ============================================================================
// Constants
// Requirement 6.1: 50 sayfa = 1000 kayıt eşiği
// ============================================================================

/**
 * Bir sayfadaki log kaydı sayısı
 * 20 kayıt = 1 sayfa
 */
export const PAGE_SIZE = 20;

/**
 * Bildirim tetikleme eşiği (sayfa sayısı)
 * 50 sayfa = 1000 kayıt
 */
export const NOTIFICATION_THRESHOLD = 50;

/**
 * Toplam kayıt eşiği (PAGE_SIZE * NOTIFICATION_THRESHOLD)
 * 20 * 50 = 1000 kayıt
 */
export const TOTAL_ENTRY_THRESHOLD = PAGE_SIZE * NOTIFICATION_THRESHOLD;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Eşik yapılandırma interface'i
 * Log birikimi için sayfa boyutu ve bildirim eşiği tanımlar
 */
export interface ThresholdConfig {
  /** Bir sayfadaki kayıt sayısı (varsayılan: 20) */
  pageSize: number;
  /** Bildirim tetikleme eşiği - sayfa sayısı (varsayılan: 50) */
  notificationThreshold: number;
}

/**
 * Eşik durumu interface'i
 * Mevcut log birikimi durumunu ve bildirim geçmişini içerir
 */
export interface ThresholdStatus {
  /** Mevcut toplam log kaydı sayısı */
  currentCount: number;
  /** Mevcut sayfa sayısı (currentCount / pageSize) */
  currentPages: number;
  /** Eşiğe ulaşılıp ulaşılmadığı */
  thresholdReached: boolean;
  /** Son bildirim gönderim tarihi (null ise hiç bildirim gönderilmemiş) */
  lastNotificationAt: Date | null;
}

/**
 * Varsayılan eşik yapılandırması
 * PAGE_SIZE = 20, NOTIFICATION_THRESHOLD = 50
 */
export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  pageSize: PAGE_SIZE,
  notificationThreshold: NOTIFICATION_THRESHOLD,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Log sayısından sayfa sayısını hesaplar
 * @param logCount - Toplam log kaydı sayısı
 * @param pageSize - Bir sayfadaki kayıt sayısı (varsayılan: PAGE_SIZE)
 * @returns Sayfa sayısı (yukarı yuvarlanmış)
 */
export function calculatePageCount(logCount: number, pageSize: number = PAGE_SIZE): number {
  if (logCount <= 0) {
    return 0;
  }
  return Math.ceil(logCount / pageSize);
}

/**
 * Eşiğe ulaşılıp ulaşılmadığını kontrol eder
 * @param currentPages - Mevcut sayfa sayısı
 * @param threshold - Bildirim eşiği (varsayılan: NOTIFICATION_THRESHOLD)
 * @returns Eşiğe ulaşılıp ulaşılmadığı
 */
export function isThresholdReached(
  currentPages: number,
  threshold: number = NOTIFICATION_THRESHOLD
): boolean {
  return currentPages >= threshold;
}

/**
 * Eşik durumunu oluşturur
 * @param currentCount - Mevcut log kaydı sayısı
 * @param lastNotificationAt - Son bildirim tarihi
 * @param config - Eşik yapılandırması (varsayılan: DEFAULT_THRESHOLD_CONFIG)
 * @returns Eşik durumu
 */
export function createThresholdStatus(
  currentCount: number,
  lastNotificationAt: Date | null = null,
  config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG
): ThresholdStatus {
  const currentPages = calculatePageCount(currentCount, config.pageSize);
  const thresholdReached = isThresholdReached(currentPages, config.notificationThreshold);

  return {
    currentCount,
    currentPages,
    thresholdReached,
    lastNotificationAt,
  };
}


// ============================================================================
// Database Functions
// Requirement 6.1: Log sayısını hesapla ve eşik durumunu kontrol et
// ============================================================================

/**
 * Veritabanından mevcut log sayfa sayısını getirir
 * @returns Mevcut sayfa sayısı
 */
export async function getLogPageCount(): Promise<number> {
  const count = await prisma.activityLog.count();
  return calculatePageCount(count, PAGE_SIZE);
}

/**
 * Mevcut eşik durumunu kontrol eder
 * Veritabanından log sayısını ve son bildirim tarihini alarak ThresholdStatus döndürür
 * 
 * Requirement 6.1: WHEN the log count reaches 50 pages (1000 entries) 
 * THEN THE Notification_System SHALL send a notification to the Owner
 * 
 * @returns Eşik durumu (currentCount, currentPages, thresholdReached, lastNotificationAt)
 */
export async function checkThreshold(): Promise<ThresholdStatus> {
  // Mevcut log sayısını al
  const currentCount = await prisma.activityLog.count();
  
  // LogThreshold kaydını al (varsa)
  const thresholdRecord = await prisma.logThreshold.findFirst();
  
  // Eşik durumunu oluştur ve döndür
  return createThresholdStatus(
    currentCount,
    thresholdRecord?.lastNotificationAt ?? null,
    DEFAULT_THRESHOLD_CONFIG
  );
}


// ============================================================================
// Notification Functions
// Requirement 6.1, 6.2, 6.3, 6.4, 6.5: Bildirim gönderme ve duplicate engelleme
// ============================================================================

/**
 * Bildirim gönderilip gönderilmeyeceğini kontrol eder
 * 
 * Requirement 6.4: THE Notification_System SHALL send only one notification per 50-page threshold
 * Requirement 6.5: IF the Owner has not downloaded logs from previous notification 
 *                  THEN THE Notification_System SHALL not send duplicate notifications
 * 
 * @param ownerId - Owner kullanıcı ID'si
 * @returns Bildirim gönderilmeli mi?
 */
export async function shouldSendNotification(ownerId: string): Promise<boolean> {
  // Mevcut log sayısını ve eşik durumunu kontrol et
  const status = await checkThreshold();
  
  // Eşiğe ulaşılmadıysa bildirim gönderme
  if (!status.thresholdReached) {
    return false;
  }
  
  // LogThreshold kaydını al
  const thresholdRecord = await prisma.logThreshold.findFirst();
  
  // LogPermission kaydını kontrol et
  const permission = await prisma.logPermission.findUnique({
    where: { userId: ownerId },
  });
  
  // Eğer owner'ın zaten download yetkisi varsa ve henüz indirmemişse
  // duplicate bildirim gönderme (Requirement 6.5)
  if (permission?.canDownload && !permission.downloadedAt) {
    return false;
  }
  
  // Son bildirimden bu yana yeni bir eşiğe ulaşılıp ulaşılmadığını kontrol et
  // Requirement 6.4: Her 50 sayfa için sadece bir bildirim
  if (thresholdRecord?.lastNotificationAt) {
    const lastNotificationCount = thresholdRecord.lastNotificationCount || 0;
    const currentThresholdMultiple = Math.floor(status.currentCount / TOTAL_ENTRY_THRESHOLD);
    const lastThresholdMultiple = Math.floor(lastNotificationCount / TOTAL_ENTRY_THRESHOLD);
    
    // Aynı eşik katında bildirim zaten gönderilmişse, tekrar gönderme
    if (currentThresholdMultiple <= lastThresholdMultiple) {
      return false;
    }
  }
  
  return true;
}

/**
 * Owner'a log birikimi bildirimi gönderir ve download yetkisi verir
 * 
 * Requirement 6.1: WHEN the log count reaches 50 pages (1000 entries) 
 *                  THEN THE Notification_System SHALL send a notification to the Owner
 * Requirement 6.2: WHEN sending log accumulation notification 
 *                  THEN THE Notification_System SHALL include the message "Log geçmişi 50 sayfa oldu"
 * Requirement 6.3: WHEN the notification is sent 
 *                  THEN THE Notification_System SHALL grant Download_Permission to the Owner
 * Requirement 6.4: THE Notification_System SHALL send only one notification per 50-page threshold
 * Requirement 6.5: IF the Owner has not downloaded logs from previous notification 
 *                  THEN THE Notification_System SHALL not send duplicate notifications
 * 
 * @param ownerId - Owner kullanıcı ID'si
 * @throws Error - Owner bulunamazsa veya bildirim oluşturulamazsa
 */
export async function triggerNotification(ownerId: string): Promise<void> {
  // Bildirim gönderilmeli mi kontrol et (duplicate engelleme)
  const shouldSend = await shouldSendNotification(ownerId);
  
  if (!shouldSend) {
    return; // Duplicate bildirim engellendi
  }
  
  // Owner'ın var olduğunu doğrula
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
  });
  
  if (!owner) {
    throw new Error(`Owner bulunamadı: ${ownerId}`);
  }
  
  // Mevcut log sayısını al
  const currentCount = await prisma.activityLog.count();
  
  // Requirement 6.2: "Log geçmişi 50 sayfa oldu" mesajı ile bildirim oluştur
  await createNotification({
    userId: ownerId,
    type: 'system',
    title: 'Log Birikimi Bildirimi',
    message: 'Log geçmişi 50 sayfa oldu',
    data: {
      logCount: currentCount,
      pageCount: calculatePageCount(currentCount),
      action: 'download_logs',
      link: '/admin/logs',
    },
  });
  
  // Requirement 6.3: Download yetkisi ver
  await prisma.logPermission.upsert({
    where: { userId: ownerId },
    create: {
      userId: ownerId,
      canDownload: true,
      canDelete: false,
      grantedAt: new Date(),
    },
    update: {
      canDownload: true,
      grantedAt: new Date(),
      // downloadedAt'i sıfırlama - yeni bildirim için
      downloadedAt: null,
    },
  });
  
  // LogThreshold kaydını güncelle
  const existingThreshold = await prisma.logThreshold.findFirst();
  
  if (existingThreshold) {
    await prisma.logThreshold.update({
      where: { id: existingThreshold.id },
      data: {
        lastNotificationAt: new Date(),
        lastNotificationCount: currentCount,
      },
    });
  } else {
    await prisma.logThreshold.create({
      data: {
        lastNotificationAt: new Date(),
        lastNotificationCount: currentCount,
      },
    });
  }
}
