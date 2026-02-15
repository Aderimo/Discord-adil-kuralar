/**
 * Ceza Şablonları Veri Yapıları
 * Hazır ban/ceza mesaj şablonları için tip tanımları
 *
 * Requirements: 8.1 - THE System SHALL provide pre-defined ban message templates for common scenarios
 */

/**
 * Şablon kategorileri
 * Ban, mute veya uyarı şablonları için kategori tipi
 */
export type TemplateCategory = 'ban' | 'mute' | 'warn';

/**
 * Ceza Şablonu Interface
 */
export interface PenaltyTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  message: string;
  editableBy: string[];

  /** Şablon oluşturulma tarihi */
  createdAt: Date;

  /** Şablon son güncellenme tarihi */
  updatedAt: Date;
}

/**
 * Şablon indeks dosyası yapısı
 */
export interface TemplateIndex {
  templates: PenaltyTemplate[];
  lastUpdated: string;
  version: string;
}
