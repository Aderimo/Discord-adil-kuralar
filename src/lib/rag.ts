/**
 * RAG (Retrieval-Augmented Generation) Servisi
 * AI asistan için içerik retrieval ve context oluşturma
 *
 * Requirements: 6.1, 6.4
 * - 6.1: AI ceza sorusu için site içeriğinden doğru ceza süresini bulup yanıtlamalı
 * - 6.4: Sadece "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermeli
 */

import { VectorSearchResult } from '@/types/content';
import {
  searchSimilar,
  isVectorStoreInitialized,
  initializeVectorStore,
  getChunksBySourceId,
} from './vector-store';

/**
 * RAG retrieval sonucu
 */
export interface RAGRetrievalResult {
  /** Bulunan içerik chunk'ları */
  chunks: RetrievedChunk[];
  /** Birleştirilmiş context metni */
  context: string;
  /** Kaynak referansları */
  sources: SourceReference[];
  /** Toplam relevance skoru (ortalama) */
  averageRelevance: number;
  /** Sorgu */
  query: string;
}

/**
 * Retrieve edilmiş chunk
 */
export interface RetrievedChunk {
  /** Chunk ID */
  id: string;
  /** Chunk içeriği */
  content: string;
  /** Kaynak tipi */
  sourceType: 'guide' | 'penalty' | 'command' | 'procedure';
  /** Kaynak ID */
  sourceId: string;
  /** Başlık */
  title: string;
  /** Kategori */
  category: string;
  /** Alt kategori (varsa) */
  subcategory?: string | undefined;
  /** Relevance skoru (0-1) */
  relevanceScore: number;
  /** Anahtar kelimeler */
  keywords: string[];
}

/**
 * Kaynak referansı (AI yanıtlarında citation için)
 */
export interface SourceReference {
  /** Kaynak ID */
  id: string;
  /** Kaynak başlığı */
  title: string;
  /** Kaynak tipi */
  type: 'guide' | 'penalty' | 'command' | 'procedure';
  /** Kategori */
  category: string;
  /** Alt kategori (varsa) */
  subcategory?: string | undefined;
  /** Relevance skoru */
  relevanceScore: number;
}

/**
 * Retrieval konfigürasyonu
 */
export interface RetrievalConfig {
  /** Döndürülecek maksimum chunk sayısı */
  topK?: number;
  /** Minimum relevance skoru (0-1) */
  minRelevance?: number;
  /** Filtrelenecek içerik tipleri */
  contentTypes?: ('guide' | 'penalty' | 'command' | 'procedure')[];
  /** Maksimum context token sayısı (yaklaşık) */
  maxContextTokens?: number;
  /** Mock embedding kullan (test için) */
  useMockEmbedding?: boolean;
}

/**
 * Varsayılan retrieval konfigürasyonu
 */
const DEFAULT_RETRIEVAL_CONFIG: Required<RetrievalConfig> = {
  topK: 5,
  minRelevance: 0.3,
  contentTypes: ['guide', 'penalty', 'command', 'procedure'],
  maxContextTokens: 2000,
  useMockEmbedding: false,
};

/**
 * VectorSearchResult'ı RetrievedChunk'a dönüştürür
 */
function toRetrievedChunk(result: VectorSearchResult): RetrievedChunk {
  return {
    id: result.chunk.id,
    content: result.chunk.content,
    sourceType: result.chunk.sourceType,
    sourceId: result.chunk.sourceId,
    title: result.chunk.metadata.title,
    category: result.chunk.metadata.category,
    subcategory: result.chunk.metadata.subcategory,
    relevanceScore: result.similarity,
    keywords: result.chunk.metadata.keywords,
  };
}

/**
 * RetrievedChunk'lardan benzersiz kaynak referansları oluşturur
 */
function extractSourceReferences(chunks: RetrievedChunk[]): SourceReference[] {
  const sourceMap = new Map<string, SourceReference>();

  for (const chunk of chunks) {
    // Aynı kaynaktan birden fazla chunk varsa, en yüksek relevance skorunu kullan
    const existing = sourceMap.get(chunk.sourceId);
    if (!existing || existing.relevanceScore < chunk.relevanceScore) {
      sourceMap.set(chunk.sourceId, {
        id: chunk.sourceId,
        title: chunk.title,
        type: chunk.sourceType,
        category: chunk.category,
        subcategory: chunk.subcategory,
        relevanceScore: chunk.relevanceScore,
      });
    }
  }

  // Relevance skoruna göre sırala
  return Array.from(sourceMap.values()).sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );
}

/**
 * Chunk'ları birleştirerek context metni oluşturur
 */
function buildContextText(
  chunks: RetrievedChunk[],
  maxTokens: number
): string {
  // Yaklaşık token hesabı (4 karakter = 1 token)
  const maxChars = maxTokens * 4;
  let context = '';

  for (const chunk of chunks) {
    // Her chunk için başlık ve içerik ekle
    const chunkText = `[${chunk.title}]\n${chunk.content}\n\n`;

    if (context.length + chunkText.length > maxChars) {
      break;
    }

    context += chunkText;
  }

  return context.trim();
}

/**
 * Ortalama relevance skorunu hesaplar
 */
function calculateAverageRelevance(chunks: RetrievedChunk[]): number {
  if (chunks.length === 0) {
    return 0;
  }

  const totalScore = chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0);
  return totalScore / chunks.length;
}

/**
 * Ana RAG retrieval fonksiyonu
 * Kullanıcı sorgusuna göre ilgili içeriği getirir
 *
 * @param query - Kullanıcı sorgusu
 * @param config - Retrieval konfigürasyonu
 * @returns RAG retrieval sonucu
 */
export async function retrieveContext(
  query: string,
  config: RetrievalConfig = {}
): Promise<RAGRetrievalResult> {
  // Konfigürasyonu varsayılanlarla birleştir
  const finalConfig: Required<RetrievalConfig> = {
    ...DEFAULT_RETRIEVAL_CONFIG,
    ...config,
  };

  // Boş sorgu kontrolü
  if (!query || query.trim().length === 0) {
    return {
      chunks: [],
      context: '',
      sources: [],
      averageRelevance: 0,
      query: '',
    };
  }

  const trimmedQuery = query.trim();

  // Vector store'un başlatıldığından emin ol
  if (!isVectorStoreInitialized()) {
    await initializeVectorStore(finalConfig.useMockEmbedding);
  }

  // Benzer içerikleri ara
  const searchResults = await searchSimilar(
    trimmedQuery,
    finalConfig.topK * 2, // Filtreleme için daha fazla sonuç al
    finalConfig.minRelevance,
    finalConfig.useMockEmbedding
  );

  // İçerik tipine göre filtrele
  const filteredResults = searchResults.filter((result) =>
    finalConfig.contentTypes.includes(result.chunk.sourceType)
  );

  // TopK'ya göre kes
  const topResults = filteredResults.slice(0, finalConfig.topK);

  // RetrievedChunk'lara dönüştür
  const chunks = topResults.map(toRetrievedChunk);

  // Context metni oluştur
  const context = buildContextText(chunks, finalConfig.maxContextTokens);

  // Kaynak referansları oluştur
  const sources = extractSourceReferences(chunks);

  // Ortalama relevance hesapla
  const averageRelevance = calculateAverageRelevance(chunks);

  return {
    chunks,
    context,
    sources,
    averageRelevance,
    query: trimmedQuery,
  };
}

/**
 * Belirli bir içerik tipine göre retrieval yapar
 *
 * @param query - Kullanıcı sorgusu
 * @param contentType - İçerik tipi
 * @param config - Retrieval konfigürasyonu
 * @returns RAG retrieval sonucu
 */
export async function retrieveByContentType(
  query: string,
  contentType: 'guide' | 'penalty' | 'command' | 'procedure',
  config: Omit<RetrievalConfig, 'contentTypes'> = {}
): Promise<RAGRetrievalResult> {
  return retrieveContext(query, {
    ...config,
    contentTypes: [contentType],
  });
}

/**
 * Ceza sorguları için özelleştirilmiş retrieval
 * Ceza tanımları ve ilgili kılavuz içeriğini getirir
 *
 * @param query - Ceza sorgusu
 * @param config - Retrieval konfigürasyonu
 * @returns RAG retrieval sonucu
 */
export async function retrievePenaltyContext(
  query: string,
  config: Omit<RetrievalConfig, 'contentTypes'> = {}
): Promise<RAGRetrievalResult> {
  // Önce ceza tanımlarını ara
  const penaltyResult = await retrieveByContentType(query, 'penalty', {
    ...config,
    topK: 3,
  });

  // Sonra kılavuz içeriğini ara
  const guideResult = await retrieveByContentType(query, 'guide', {
    ...config,
    topK: 2,
  });

  // Sonuçları birleştir
  const allChunks = [...penaltyResult.chunks, ...guideResult.chunks];

  // Relevance skoruna göre sırala
  allChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Context ve sources oluştur
  const maxTokens = config.maxContextTokens ?? DEFAULT_RETRIEVAL_CONFIG.maxContextTokens;
  const context = buildContextText(allChunks, maxTokens);
  const sources = extractSourceReferences(allChunks);
  const averageRelevance = calculateAverageRelevance(allChunks);

  return {
    chunks: allChunks,
    context,
    sources,
    averageRelevance,
    query: query.trim(),
  };
}

/**
 * Komut sorguları için özelleştirilmiş retrieval
 *
 * @param query - Komut sorgusu
 * @param config - Retrieval konfigürasyonu
 * @returns RAG retrieval sonucu
 */
export async function retrieveCommandContext(
  query: string,
  config: Omit<RetrievalConfig, 'contentTypes'> = {}
): Promise<RAGRetrievalResult> {
  return retrieveByContentType(query, 'command', config);
}

/**
 * Prosedür sorguları için özelleştirilmiş retrieval
 *
 * @param query - Prosedür sorgusu
 * @param config - Retrieval konfigürasyonu
 * @returns RAG retrieval sonucu
 */
export async function retrieveProcedureContext(
  query: string,
  config: Omit<RetrievalConfig, 'contentTypes'> = {}
): Promise<RAGRetrievalResult> {
  return retrieveByContentType(query, 'procedure', config);
}

/**
 * Kaynak referanslarını AI yanıtı için formatlar
 *
 * @param sources - Kaynak referansları
 * @returns Formatlanmış kaynak metni
 */
export function formatSourcesForCitation(sources: SourceReference[]): string {
  if (sources.length === 0) {
    return '';
  }

  const lines = sources.map((source, index) => {
    const typeLabel = getSourceTypeLabel(source.type);
    const relevancePercent = Math.round(source.relevanceScore * 100);
    return `[${index + 1}] ${typeLabel}: ${source.title} (İlgililik: %${relevancePercent})`;
  });

  return `\n\n📚 Kaynaklar:\n${lines.join('\n')}`;
}

/**
 * Kaynak tipini Türkçe etikete dönüştürür
 */
function getSourceTypeLabel(type: 'guide' | 'penalty' | 'command' | 'procedure'): string {
  const labels: Record<string, string> = {
    guide: 'Kılavuz',
    penalty: 'Ceza',
    command: 'Komut',
    procedure: 'Prosedür',
  };
  return labels[type] || type;
}

/**
 * Retrieval sonucunun güven seviyesini belirler
 *
 * @param result - RAG retrieval sonucu
 * @returns Güven seviyesi
 */
export function determineConfidenceLevel(
  result: RAGRetrievalResult
): 'high' | 'medium' | 'low' {
  // Hiç sonuç yoksa düşük güven
  if (result.chunks.length === 0) {
    return 'low';
  }

  // Ortalama relevance'a göre güven seviyesi
  if (result.averageRelevance >= 0.7) {
    return 'high';
  } else if (result.averageRelevance >= 0.5) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Belirli bir kaynak ID'sine ait tüm içeriği getirir
 *
 * @param sourceId - Kaynak ID
 * @returns Kaynak içeriği veya null
 */
export function getFullSourceContent(sourceId: string): string | null {
  const chunks = getChunksBySourceId(sourceId);

  if (chunks.length === 0) {
    return null;
  }

  // Chunk'ları sırala ve birleştir
  const sortedChunks = chunks.sort(
    (a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex
  );

  return sortedChunks.map((chunk) => chunk.content).join('\n\n');
}

/**
 * RAG servisinin hazır olup olmadığını kontrol eder
 */
export function isRAGReady(): boolean {
  return isVectorStoreInitialized();
}

/**
 * RAG servisini başlatır
 *
 * @param useMockEmbedding - Test için mock embedding kullan
 */
export async function initializeRAG(useMockEmbedding = false): Promise<void> {
  if (!isVectorStoreInitialized()) {
    await initializeVectorStore(useMockEmbedding);
  }
}
