// Permission Manager Service - Log indirme ve silme yetkileri yönetimi
// Requirement 7.4: WHEN download completes successfully THEN THE Logging_System SHALL grant Delete_Permission to the Owner
// Requirement 8.2: WHEN the Owner initiates deletion THEN THE Logging_System SHALL remove all downloaded log entries
// Requirement 8.3: WHEN deletion completes THEN THE Logging_System SHALL revoke Delete_Permission from the Owner
// Requirement 8.4: WHEN Delete_Permission is revoked THEN THE Logging_System SHALL require 50 more pages to accumulate before granting new permission
// Requirement 8.5: IF the Owner attempts deletion without Delete_Permission THEN THE Logging_System SHALL reject the request
// Requirement 8.6: THE Logging_System SHALL log the deletion action itself before removing entries

import { prisma } from './prisma';

// ============================================================================
// Interfaces
// Design.md'de tanımlanan LogPermission interface'i
// ============================================================================

/**
 * Log yetki durumu interface'i
 * Kullanıcının log indirme ve silme yetkilerini tanımlar
 * 
 * Requirement 7.4: Download yetkisi ve Delete yetkisi yönetimi
 * Requirement 8.3: Silme sonrası yetki iptali
 */
export interface LogPermission {
  /** Benzersiz yetki kaydı ID'si */
  id: string;
  /** Kullanıcı ID'si */
  userId: string;
  /** İndirme yetkisi */
  canDownload: boolean;
  /** Silme yetkisi */
  canDelete: boolean;
  /** Yetki verilme tarihi */
  grantedAt: Date;
  /** İndirme tarihi (null ise henüz indirilmemiş) */
  downloadedAt: Date | null;
  /** Silme tarihi (null ise henüz silinmemiş) */
  deletedAt: Date | null;
}

/**
 * Yetki durumu enum'u
 * State machine geçişleri için kullanılır
 * 
 * none → download → delete → none (silme sonrası)
 */
export type PermissionState = 'none' | 'download' | 'delete';

/**
 * Yetki işlem sonucu interface'i
 */
export interface PermissionResult {
  success: boolean;
  permission: LogPermission | null;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Prisma LogPermission kaydını uygulama LogPermission interface'ine dönüştürür
 * @param dbPermission - Veritabanı kaydı
 * @returns LogPermission interface'i
 */
export function toLogPermission(dbPermission: {
  id: string;
  userId: string;
  canDownload: boolean;
  canDelete: boolean;
  grantedAt: Date;
  downloadedAt: Date | null;
  deletedAt: Date | null;
}): LogPermission {
  return {
    id: dbPermission.id,
    userId: dbPermission.userId,
    canDownload: dbPermission.canDownload,
    canDelete: dbPermission.canDelete,
    grantedAt: dbPermission.grantedAt,
    downloadedAt: dbPermission.downloadedAt,
    deletedAt: dbPermission.deletedAt,
  };
}

/**
 * Mevcut yetki durumunu belirler
 * @param permission - LogPermission kaydı
 * @returns Yetki durumu: 'none' | 'download' | 'delete'
 */
export function getPermissionState(permission: LogPermission | null): PermissionState {
  if (!permission) {
    return 'none';
  }
  
  if (permission.canDelete) {
    return 'delete';
  }
  
  if (permission.canDownload) {
    return 'download';
  }
  
  return 'none';
}

/**
 * State geçişinin geçerli olup olmadığını kontrol eder
 * 
 * Geçerli geçişler:
 * - none → download (grantDownloadPermission)
 * - download → delete (grantDeletePermission - indirme sonrası)
 * - delete → none (revokeDeletePermission - silme sonrası)
 * 
 * @param currentState - Mevcut durum
 * @param targetState - Hedef durum
 * @returns Geçişin geçerli olup olmadığı
 */
export function isValidStateTransition(
  currentState: PermissionState,
  targetState: PermissionState
): boolean {
  // Aynı duruma geçiş her zaman geçerli (idempotent)
  if (currentState === targetState) {
    return true;
  }
  
  // Geçerli geçişler
  const validTransitions: Record<PermissionState, PermissionState[]> = {
    'none': ['download'],      // none → download
    'download': ['delete'],    // download → delete
    'delete': ['none'],        // delete → none
  };
  
  return validTransitions[currentState]?.includes(targetState) ?? false;
}

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Kullanıcının yetki durumunu getirir
 * @param userId - Kullanıcı ID'si
 * @returns LogPermission veya null
 */
export async function getPermissionStatus(userId: string): Promise<LogPermission | null> {
  const permission = await prisma.logPermission.findUnique({
    where: { userId },
  });
  
  if (!permission) {
    return null;
  }
  
  return toLogPermission(permission);
}

/**
 * İndirme yetkisi verir
 * 
 * Requirement 6.3: WHEN the notification is sent THEN THE Notification_System SHALL grant Download_Permission to the Owner
 * 
 * State geçişi: none → download
 * 
 * @param userId - Kullanıcı ID'si
 * @returns Güncellenmiş LogPermission
 */
export async function grantDownloadPermission(userId: string): Promise<LogPermission> {
  // Mevcut yetkiyi kontrol et
  const existingPermission = await getPermissionStatus(userId);
  const currentState = getPermissionState(existingPermission);
  
  // State geçişi kontrolü
  // none → download geçerli
  // download → download idempotent (zaten var)
  if (currentState === 'delete') {
    // delete durumundayken download yetkisi verilemez
    // Önce silme işlemi tamamlanmalı
    throw new Error('Silme yetkisi aktifken indirme yetkisi verilemez. Önce silme işlemini tamamlayın.');
  }
  
  // Yetki kaydını oluştur veya güncelle
  const permission = await prisma.logPermission.upsert({
    where: { userId },
    create: {
      userId,
      canDownload: true,
      canDelete: false,
      grantedAt: new Date(),
      downloadedAt: null,
      deletedAt: null,
    },
    update: {
      canDownload: true,
      grantedAt: new Date(),
      // downloadedAt'i sıfırlama - yeni yetki döngüsü
      downloadedAt: null,
    },
  });
  
  return toLogPermission(permission);
}

/**
 * Silme yetkisi verir
 * 
 * Requirement 7.4: WHEN download completes successfully THEN THE Logging_System SHALL grant Delete_Permission to the Owner
 * 
 * State geçişi: download → delete
 * Bu fonksiyon sadece indirme tamamlandıktan sonra çağrılmalıdır.
 * 
 * @param userId - Kullanıcı ID'si
 * @returns Güncellenmiş LogPermission
 * @throws Error - İndirme yetkisi yoksa veya henüz indirilmemişse
 */
export async function grantDeletePermission(userId: string): Promise<LogPermission> {
  // Mevcut yetkiyi kontrol et
  const existingPermission = await getPermissionStatus(userId);
  
  if (!existingPermission) {
    throw new Error('Yetki kaydı bulunamadı. Önce indirme yetkisi verilmelidir.');
  }
  
  const currentState = getPermissionState(existingPermission);
  
  // State geçişi kontrolü: download → delete
  if (currentState === 'none') {
    throw new Error('İndirme yetkisi yok. Önce indirme yetkisi verilmelidir.');
  }
  
  if (currentState === 'delete') {
    // Zaten delete durumunda - idempotent
    return existingPermission;
  }
  
  // download durumunda - delete yetkisi ver
  // İndirme işleminin tamamlandığını kaydet
  const permission = await prisma.logPermission.update({
    where: { userId },
    data: {
      canDelete: true,
      downloadedAt: new Date(),
    },
  });
  
  return toLogPermission(permission);
}

/**
 * Silme yetkisini iptal eder
 * 
 * Requirement 8.3: WHEN deletion completes THEN THE Logging_System SHALL revoke Delete_Permission from the Owner
 * Requirement 8.4: WHEN Delete_Permission is revoked THEN THE Logging_System SHALL require 50 more pages to accumulate before granting new permission
 * 
 * State geçişi: delete → none
 * Bu fonksiyon silme işlemi tamamlandıktan sonra çağrılmalıdır.
 * 
 * @param userId - Kullanıcı ID'si
 * @throws Error - Silme yetkisi yoksa
 */
export async function revokeDeletePermission(userId: string): Promise<void> {
  // Mevcut yetkiyi kontrol et
  const existingPermission = await getPermissionStatus(userId);
  
  if (!existingPermission) {
    // Yetki kaydı yok - zaten none durumunda
    return;
  }
  
  const currentState = getPermissionState(existingPermission);
  
  // State geçişi kontrolü: delete → none
  if (currentState === 'none') {
    // Zaten none durumunda - idempotent
    return;
  }
  
  if (currentState === 'download') {
    // download durumunda silme yetkisi iptal edilemez
    // Çünkü zaten silme yetkisi yok
    throw new Error('Silme yetkisi zaten yok. İptal edilecek bir şey yok.');
  }
  
  // delete durumunda - yetkiyi iptal et
  // Requirement 8.4: Yeni yetki için 50 sayfa daha birikmeli
  await prisma.logPermission.update({
    where: { userId },
    data: {
      canDownload: false,
      canDelete: false,
      deletedAt: new Date(),
    },
  });
}

/**
 * Belirli bir işlem için yetki kontrolü yapar
 * 
 * Requirement 8.5: IF the Owner attempts deletion without Delete_Permission THEN THE Logging_System SHALL reject the request
 * 
 * @param userId - Kullanıcı ID'si
 * @param action - Kontrol edilecek işlem: 'download' | 'delete'
 * @returns Yetkinin olup olmadığı
 */
export async function checkPermission(
  userId: string,
  action: 'download' | 'delete'
): Promise<boolean> {
  const permission = await getPermissionStatus(userId);
  
  if (!permission) {
    return false;
  }
  
  if (action === 'download') {
    return permission.canDownload;
  }
  
  if (action === 'delete') {
    return permission.canDelete;
  }
  
  return false;
}

/**
 * Yetki durumunu sıfırlar (test amaçlı)
 * @param userId - Kullanıcı ID'si
 */
export async function resetPermission(userId: string): Promise<void> {
  await prisma.logPermission.deleteMany({
    where: { userId },
  });
}

// ============================================================================
// Pure Functions (Test edilebilir, veritabanı bağımsız)
// ============================================================================

/**
 * İndirme yetkisi verilebilir mi kontrol eder (pure function)
 * @param currentState - Mevcut yetki durumu
 * @returns İndirme yetkisi verilebilir mi
 */
export function canGrantDownload(currentState: PermissionState): boolean {
  // none veya download durumunda indirme yetkisi verilebilir
  return currentState === 'none' || currentState === 'download';
}

/**
 * Silme yetkisi verilebilir mi kontrol eder (pure function)
 * @param currentState - Mevcut yetki durumu
 * @returns Silme yetkisi verilebilir mi
 */
export function canGrantDelete(currentState: PermissionState): boolean {
  // Sadece download durumunda silme yetkisi verilebilir
  return currentState === 'download';
}

/**
 * Silme yetkisi iptal edilebilir mi kontrol eder (pure function)
 * @param currentState - Mevcut yetki durumu
 * @returns Silme yetkisi iptal edilebilir mi
 */
export function canRevokeDelete(currentState: PermissionState): boolean {
  // Sadece delete durumunda silme yetkisi iptal edilebilir
  return currentState === 'delete';
}

/**
 * Yetki state machine geçişini simüle eder (pure function)
 * @param currentState - Mevcut durum
 * @param action - Yapılacak işlem
 * @returns Yeni durum veya null (geçersiz geçiş)
 */
export function simulateStateTransition(
  currentState: PermissionState,
  action: 'grantDownload' | 'grantDelete' | 'revokeDelete'
): PermissionState | null {
  switch (action) {
    case 'grantDownload':
      if (canGrantDownload(currentState)) {
        return 'download';
      }
      return null;
    
    case 'grantDelete':
      if (canGrantDelete(currentState)) {
        return 'delete';
      }
      return null;
    
    case 'revokeDelete':
      if (canRevokeDelete(currentState)) {
        return 'none';
      }
      return null;
    
    default:
      return null;
  }
}

/**
 * Tam yetki döngüsünü simüle eder (pure function)
 * none → download → delete → none
 * 
 * @param actions - Yapılacak işlemler dizisi
 * @returns Son durum
 */
export function simulatePermissionCycle(
  actions: Array<'grantDownload' | 'grantDelete' | 'revokeDelete'>
): PermissionState {
  let state: PermissionState = 'none';
  
  for (const action of actions) {
    const newState = simulateStateTransition(state, action);
    if (newState !== null) {
      state = newState;
    }
    // Geçersiz geçişler sessizce yoksayılır
  }
  
  return state;
}
