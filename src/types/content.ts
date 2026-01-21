/**
 * İçerik Veri Yapıları
 * Yetkili Kılavuzu, Cezalar, Komutlar ve Prosedürler için tip tanımları
 * 
 * Requirements: 4.1, 4.3, 4.4, 10.2
 */

// İçerik kategorileri
export type ContentCategory = 'kilavuz' | 'ceza' | 'komut' | 'prosedur';

// Ceza alt kategorileri
export type PenaltyCategory = 'yazili' | 'sesli' | 'ekstra' | 'marked' | 'blacklist';

// Komut kategorileri
export type CommandCategory = 'ceza' | 'bilgi' | 'sesli' | 'gk-plus';

/**
 * Yetkili Kılavuzu İçerik Yapısı
 * Requirement 4.1: Yetkili Kılavuzu içeriğini bölümlere ayrılmış şekilde sunmalı
 */
export interface GuideContent {
  /** Benzersiz tanımlayıcı */
  id: string;
  /** İçerik başlığı */
  title: string;
  /** URL-dostu slug */
  slug: string;
  /** Ana kategori */
  category: ContentCategory;
  /** Alt kategori (cezalar için: yazili, sesli, ekstra, marked, blacklist) */
  subcategory?: PenaltyCategory;
  /** Markdown formatında içerik */
  content: string;
  /** Arama için anahtar kelimeler */
  keywords: string[];
  /** İlişkili makale ID'leri */
  relatedArticles: string[];
  /** Sıralama numarası */
  order: number;
  /** Oluşturulma tarihi */
  createdAt?: string;
  /** Güncellenme tarihi */
  updatedAt?: string;
}

/**
 * Ceza Tanımı
 * Requirement 4.3: Cezaları kategorilere ayırmalı (yazılı, sesli, ekstra, marked, blacklist)
 */
export interface PenaltyDefinition {
  /** Benzersiz tanımlayıcı */
  id: string;
  /** Ceza kodu (örn: "ADK-001") */
  code: string;
  /** Ceza adı */
  name: string;
  /** Ceza kategorisi */
  category: PenaltyCategory;
  /** Ceza süresi (örn: "7 gün", "kalıcı") */
  duration: string;
  /** Ceza açıklaması */
  description: string;
  /** Cezanın uygulanma koşulları */
  conditions: string[];
  /** Alternatif cezalar veya esnetilebilir durumlar */
  alternatives?: string[];
  /** Örnek durumlar */
  examples: string[];
  /** Arama için anahtar kelimeler */
  keywords?: string[];
  /** Sıralama numarası */
  order?: number;
}

/**
 * Komut Tanımı
 * Requirement 4.4: Prosedürleri ve komutları ayrı bölümler olarak sunmalı
 */
export interface CommandDefinition {
  /** Benzersiz tanımlayıcı */
  id: string;
  /** Komut adı (örn: "/mute", "/ban") */
  command: string;
  /** Komut açıklaması */
  description: string;
  /** Kullanım şekli */
  usage: string;
  /** Gerekli yetkiler */
  permissions: string[];
  /** Komut kategorisi */
  category?: CommandCategory;
  /** Kullanım örnekleri */
  examples: string[];
  /** Arama için anahtar kelimeler */
  keywords?: string[];
  /** Sıralama numarası */
  order?: number;
}

/**
 * Prosedür Tanımı
 * Requirement 4.4: Prosedürleri ve komutları ayrı bölümler olarak sunmalı
 */
export interface ProcedureDefinition {
  /** Benzersiz tanımlayıcı */
  id: string;
  /** Prosedür başlığı */
  title: string;
  /** URL-dostu slug */
  slug: string;
  /** Prosedür açıklaması */
  description: string;
  /** Adım adım talimatlar (Markdown) */
  steps: string;
  /** Gerekli yetkiler */
  requiredPermissions: string[];
  /** İlgili komutlar */
  relatedCommands: string[];
  /** İlgili cezalar */
  relatedPenalties: string[];
  /** Arama için anahtar kelimeler */
  keywords?: string[];
  /** Sıralama numarası */
  order?: number;
}

/**
 * Arama sonucu tipi
 */
export type SearchResultType = 'madde' | 'ceza' | 'komut' | 'prosedur';

/**
 * Arama sonucu
 */
export interface SearchResult {
  /** Sonuç ID'si */
  id: string;
  /** Sonuç tipi */
  type: SearchResultType;
  /** Başlık */
  title: string;
  /** Özet/Alıntı */
  excerpt: string;
  /** Kategori */
  category: string;
  /** İlgililik skoru (0-1) */
  relevanceScore: number;
}

/**
 * İçerik indeks dosyası yapısı
 */
export interface ContentIndex<T> {
  /** İçerik listesi */
  items: T[];
  /** Son güncelleme tarihi */
  lastUpdated: string;
  /** Versiyon */
  version: string;
}

/**
 * Kılavuz içerik indeksi
 */
export type GuideContentIndex = ContentIndex<GuideContent>;

/**
 * Ceza indeksi
 */
export type PenaltyIndex = ContentIndex<PenaltyDefinition>;

/**
 * Komut indeksi
 */
export type CommandIndex = ContentIndex<CommandDefinition>;

/**
 * Prosedür indeksi
 */
export type ProcedureIndex = ContentIndex<ProcedureDefinition>;

/**
 * RAG için içerik chunk yapısı
 * Requirement 6.4: RAG tabanlı AI yanıt sistemi
 */
export interface ContentChunk {
  /** Benzersiz chunk tanımlayıcı */
  id: string;
  /** Kaynak içerik ID'si (GuideContent, PenaltyDefinition, vb.) */
  sourceId: string;
  /** Kaynak içerik tipi */
  sourceType: 'guide' | 'penalty' | 'command' | 'procedure';
  /** Chunk içeriği (metin) */
  content: string;
  /** OpenAI embedding vektörü */
  embedding: number[];
  /** Chunk metadata */
  metadata: {
    /** İçerik başlığı */
    title: string;
    /** İçerik kategorisi */
    category: string;
    /** Alt kategori (varsa, opsiyonel) */
    subcategory?: string;
    /** Arama için anahtar kelimeler */
    keywords: string[];
    /** Chunk sırası (aynı kaynaktan birden fazla chunk varsa) */
    chunkIndex: number;
    /** Toplam chunk sayısı */
    totalChunks: number;
  };
}

/**
 * Vector arama sonucu
 */
export interface VectorSearchResult {
  /** Chunk */
  chunk: ContentChunk;
  /** Benzerlik skoru (0-1, 1 = tam eşleşme) */
  similarity: number;
}

/**
 * Chunking konfigürasyonu
 */
export interface ChunkingConfig {
  /** Maksimum chunk boyutu (karakter) */
  maxChunkSize: number;
  /** Chunk'lar arası örtüşme (karakter) */
  overlap: number;
  /** Minimum chunk boyutu (karakter) */
  minChunkSize: number;
}
