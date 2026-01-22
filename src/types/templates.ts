/**
 * Ceza Şablonları Veri Yapıları
 * Hazır ban/ceza mesaj şablonları için tip tanımları
 *
 * Requirements: 8.1 - THE System SHALL provide pre-defined ban message templates for common scenarios
 */

import { UserRole } from './index';

/**
 * Şablon kategorileri
 * Ban, mute veya uyarı şablonları için kategori tipi
 */
export type TemplateCategory = 'ban' | 'mute' | 'warn';

/**
 * Ceza Şablonu Interface
 * Hazır ban/ceza mesaj şablonlarının veri yapısı
 *
 * @example
 * ```typescript
 * const template: PenaltyTemplate = {
 *   id: 'tpl-001',
 *   name: 'Çalıntı Hesap',
 *   category: 'ban',
 *   message: 'çalıntı hesap, hesabın çalındığından dolayı...',
 *   editableBy: ['ust_yetkili'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 */
export interface PenaltyTemplate {
  /** Benzersiz şablon tanımlayıcı (örn: "tpl-001") */
  id: string;

  /** Şablon adı (örn: "Çalıntı Hesap", "Underage") */
  name: string;

  /** Şablon kategorisi (ban, mute veya warn) */
  category: TemplateCategory;

  /** Şablon mesaj içeriği - kopyalanacak metin */
  message: string;

  /** Bu şablonu düzenleyebilecek roller */
  editableBy: UserRole[];

  /** Şablon oluşturulma tarihi */
  createdAt: Date;

  /** Şablon son güncellenme tarihi */
  updatedAt: Date;
}

/**
 * Şablon indeks dosyası yapısı
 * JSON dosyasından yüklenen şablon listesi için tip
 */
export interface TemplateIndex {
  /** Şablon listesi */
  templates: PenaltyTemplate[];

  /** Son güncelleme tarihi */
  lastUpdated: string;

  /** Versiyon numarası */
  version: string;
}

/**
 * Şablon oluşturma için input tipi
 * createdAt ve updatedAt otomatik eklenir
 */
export type CreateTemplateInput = Omit<PenaltyTemplate, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Şablon güncelleme için input tipi
 * Sadece belirli alanlar güncellenebilir
 */
export type UpdateTemplateInput = Partial<Pick<PenaltyTemplate, 'name' | 'category' | 'message' | 'editableBy'>>;
