// Merkezi tip tanımlamaları

// İçerik tiplerini re-export et
export * from './content';

// Şablon tiplerini re-export et
export * from './templates';

/**
 * Dinamik Rol Interface
 * Veritabanında saklanan rol tanımları
 */
export interface Role {
  id: string;
  code: string;
  name: string;
  shortName: string;
  description: string;
  hierarchy: number;
  color: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rol oluşturma için input tipi
 */
export type CreateRoleInput = Omit<Role, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Rol güncelleme için input tipi
 */
export type UpdateRoleInput = Partial<
  Omit<Role, 'id' | 'code' | 'isSystem' | 'createdAt' | 'updatedAt'>
>;

/**
 * Kullanıcı rolü - dinamik olarak veritabanından gelir
 * Eski sabit tipler: 'none' | 'mod' | 'admin' | 'ust_yetkili'
 * Yeni dinamik tipler: 'reg' | 'op' | 'gk' | 'council' | 'gm' | 'gm_plus' | 'owner' | string
 */
export type UserRole = string;

/**
 * Kullanıcı durumu
 */
export type UserStatus = 'pending' | 'approved' | 'rejected';

/**
 * Kullanıcı Interface
 */
export interface User {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  role: UserRole | null; // Rol kodu (örn: 'op', 'gk', etc.) veya null
  roleId: string | null; // Rol ID'si
  roleData?: Role | null; // Tam rol verisi (opsiyonel, join ile gelir)
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | undefined;
}

/**
 * Aktivite Aksiyonları
 * Genişletilmiş log türleri
 */
export type ActivityAction =
  // Kimlik doğrulama
  | 'login'
  | 'logout'
  // İçerik görüntüleme
  | 'view_content'
  | 'search'
  // AI işlemleri
  | 'ai_query'
  // Kullanıcı yönetimi
  | 'role_change'
  | 'user_approve'
  | 'user_reject'
  // İçerik işlemleri (YENİ)
  | 'copy_content'
  | 'copy_template'
  | 'edit_content'
  | 'delete_content'
  // Rol yönetimi (YENİ)
  | 'create_role'
  | 'edit_role'
  | 'delete_role'
  // Log işlemleri (YENİ)
  | 'view_logs'
  | 'export_logs'
  // Bildirim işlemleri (YENİ)
  | 'view_notifications'
  | 'mark_notification_read'
  // Gelişmiş Loglama - Ziyaretçi ve Erişim (Requirements 1.1, 3.1)
  | 'visitor_access'      // Anonim ziyaretçi erişimi
  | 'page_access'         // Sayfa erişimi (detaylı)
  // Gelişmiş Loglama - AI Etkileşim (Requirement 2.1)
  | 'ai_interaction'      // AI soru-cevap (detaylı)
  // Gelişmiş Loglama - Metin İşlemleri (Requirements 5.1, 10.1)
  | 'text_input'          // Metin girişi
  | 'text_copy'           // Metin kopyalama
  // Gelişmiş Loglama - Referrer ve URL (Requirement 9.1)
  | 'referrer_track'      // Referrer takibi
  | 'url_copy'            // URL kopyalama
  // Gelişmiş Loglama - Log Yönetimi (Requirements 7.4, 8.6)
  | 'log_download'        // Log indirme
  | 'log_delete';         // Log silme

/**
 * Aktivite Log Interface
 */
export interface ActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: Date;
}

/**
 * Oturum Interface
 */
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Bildirim Tipleri
 */
export type NotificationType =
  | 'new_registration'
  | 'content_change'
  | 'role_change'
  | 'system';

/**
 * Bildirim Interface
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

/**
 * İzin Tipleri
 * Dinamik olarak roller üzerinden kontrol edilir
 */
export type Permission =
  | 'VIEW_CONTENT'
  | 'EDIT_CONTENT'
  | 'DELETE_CONTENT'
  | 'VIEW_USERS'
  | 'EDIT_USERS'
  | 'DELETE_USERS'
  | 'VIEW_LOGS'
  | 'VIEW_NOTIFICATIONS'
  | 'EDIT_TEMPLATES'
  | 'MANAGE_ROLES';
