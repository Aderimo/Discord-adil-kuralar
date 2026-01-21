/**
 * Vector Store Servisi
 * İçerik chunking, embedding ve benzerlik araması için in-memory vector store
 *
 * Requirement 6.4: RAG tabanlı AI yanıt sistemi
 */

import {
  ContentChunk,
  VectorSearchResult,
  ChunkingConfig,
  GuideContent,
  PenaltyDefinition,
  CommandDefinition,
  ProcedureDefinition,
} from '@/types/content';
import {
  createEmbedding,
  createEmbeddings,
  cosineSimilarity,
  createMockEmbedding,
  isOpenAIAvailable,
} from './embeddings';
import {
  loadGuideContent,
  loadPenalties,
  loadCommands,
  loadProcedures,
} from './content';

/**
 * Embedding olmadan chunk verisi (ara tip)
 */
interface ChunkData {
  id: string;
  sourceId: string;
  sourceType: 'guide' | 'penalty' | 'command' | 'procedure';
  content: string;
  metadata: {
    title: string;
    category: string;
    subcategory?: string;
    keywords: string[];
    chunkIndex: number;
    totalChunks: number;
  };
}

/**
 * Varsayılan chunking konfigürasyonu
 * - maxChunkSize: 500 karakter (OpenAI için optimal)
 * - overlap: 50 karakter (bağlam kaybını önlemek için)
 * - minChunkSize: 100 karakter (çok küçük chunk'ları önlemek için)
 */
const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxChunkSize: 500,
  overlap: 50,
  minChunkSize: 100,
};

/**
 * In-memory vector store
 */
let vectorStore: ContentChunk[] = [];
let isInitialized = false;

/**
 * Metni anlamlı chunk'lara ayırır
 * Paragraf ve cümle sınırlarını korumaya çalışır
 */
export function chunkText(
  text: string,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const { maxChunkSize, overlap, minChunkSize } = config;
  const chunks: string[] = [];

  // Önce paragraflara ayır
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();

    // Paragraf tek başına maxChunkSize'dan büyükse, cümlelere ayır
    if (trimmedParagraph.length > maxChunkSize) {
      // Mevcut chunk'ı kaydet
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // Büyük paragrafı cümlelere ayır
      const sentences = splitIntoSentences(trimmedParagraph);
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length <= maxChunkSize) {
          sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
        } else {
          if (sentenceChunk.length >= minChunkSize) {
            chunks.push(sentenceChunk.trim());
          }
          sentenceChunk = sentence;
        }
      }

      if (sentenceChunk.length >= minChunkSize) {
        chunks.push(sentenceChunk.trim());
      }
    } else if (currentChunk.length + trimmedParagraph.length <= maxChunkSize) {
      // Paragrafı mevcut chunk'a ekle
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    } else {
      // Mevcut chunk'ı kaydet ve yeni chunk başlat
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedParagraph;
    }
  }

  // Son chunk'ı kaydet
  if (currentChunk.length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  }

  // Overlap uygula (isteğe bağlı, bağlam için)
  if (overlap > 0 && chunks.length > 1) {
    return applyOverlap(chunks, overlap);
  }

  return chunks;
}

/**
 * Metni cümlelere ayırır
 */
function splitIntoSentences(text: string): string[] {
  // Türkçe ve İngilizce cümle sonları
  const sentenceEndings = /([.!?])\s+/g;
  const sentences = text.split(sentenceEndings).filter((s) => s.trim().length > 0);

  // Cümle sonlarını geri ekle
  const result: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const ending = sentences[i + 1] || '';
    result.push(sentence + ending);
  }

  return result.length > 0 ? result : [text];
}

/**
 * Chunk'lar arasına overlap ekler
 */
function applyOverlap(chunks: string[], overlap: number): string[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  const firstChunk = chunks[0];
  if (!firstChunk) {
    return chunks;
  }

  const result: string[] = [firstChunk];

  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    const currentChunk = chunks[i];

    if (!prevChunk || !currentChunk) {
      continue;
    }

    // Önceki chunk'ın son kısmını al
    const overlapText = prevChunk.slice(-overlap);

    // Overlap'i mevcut chunk'ın başına ekle
    result.push(overlapText + ' ' + currentChunk);
  }

  return result;
}


/**
 * GuideContent'i chunk'lara ayırır
 */
function chunkGuideContent(guide: GuideContent): ChunkData[] {
  const chunks = chunkText(guide.content);
  const totalChunks = chunks.length;

  return chunks.map((content, index) => {
    const chunkData: ChunkData = {
      id: `${guide.id}-chunk-${index}`,
      sourceId: guide.id,
      sourceType: 'guide',
      content,
      metadata: {
        title: guide.title,
        category: guide.category,
        keywords: guide.keywords,
        chunkIndex: index,
        totalChunks,
      },
    };
    
    if (guide.subcategory) {
      chunkData.metadata.subcategory = guide.subcategory;
    }
    
    return chunkData;
  });
}

/**
 * PenaltyDefinition'ı chunk'lara ayırır
 */
function chunkPenalty(penalty: PenaltyDefinition): ChunkData[] {
  // Ceza için zengin metin oluştur
  const fullText = [
    `Ceza: ${penalty.name} (${penalty.code})`,
    `Kategori: ${penalty.category}`,
    `Süre: ${penalty.duration}`,
    `Açıklama: ${penalty.description}`,
    penalty.conditions.length > 0
      ? `Koşullar: ${penalty.conditions.join(', ')}`
      : '',
    penalty.alternatives && penalty.alternatives.length > 0
      ? `Alternatifler: ${penalty.alternatives.join(', ')}`
      : '',
    penalty.examples.length > 0
      ? `Örnekler: ${penalty.examples.join('; ')}`
      : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  const chunks = chunkText(fullText);
  const totalChunks = chunks.length;

  return chunks.map((content, index) => ({
    id: `${penalty.id}-chunk-${index}`,
    sourceId: penalty.id,
    sourceType: 'penalty' as const,
    content,
    metadata: {
      title: `${penalty.code} - ${penalty.name}`,
      category: penalty.category,
      keywords: penalty.keywords || [],
      chunkIndex: index,
      totalChunks,
    },
  }));
}

/**
 * CommandDefinition'ı chunk'lara ayırır
 */
function chunkCommand(command: CommandDefinition): ChunkData[] {
  const fullText = [
    `Komut: ${command.command}`,
    `Açıklama: ${command.description}`,
    `Kullanım: ${command.usage}`,
    command.permissions.length > 0
      ? `Yetkiler: ${command.permissions.join(', ')}`
      : '',
    command.examples.length > 0
      ? `Örnekler: ${command.examples.join('; ')}`
      : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  const chunks = chunkText(fullText);
  const totalChunks = chunks.length;

  return chunks.map((content, index) => ({
    id: `${command.id}-chunk-${index}`,
    sourceId: command.id,
    sourceType: 'command' as const,
    content,
    metadata: {
      title: command.command,
      category: 'komut',
      keywords: command.keywords || [],
      chunkIndex: index,
      totalChunks,
    },
  }));
}

/**
 * ProcedureDefinition'ı chunk'lara ayırır
 */
function chunkProcedure(procedure: ProcedureDefinition): ChunkData[] {
  const fullText = [
    `Prosedür: ${procedure.title}`,
    `Açıklama: ${procedure.description}`,
    `Adımlar:\n${procedure.steps}`,
    procedure.requiredPermissions.length > 0
      ? `Gerekli Yetkiler: ${procedure.requiredPermissions.join(', ')}`
      : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n\n');

  const chunks = chunkText(fullText);
  const totalChunks = chunks.length;

  return chunks.map((content, index) => ({
    id: `${procedure.id}-chunk-${index}`,
    sourceId: procedure.id,
    sourceType: 'procedure' as const,
    content,
    metadata: {
      title: procedure.title,
      category: 'prosedur',
      keywords: procedure.keywords || [],
      chunkIndex: index,
      totalChunks,
    },
  }));
}

/**
 * Tüm içeriği chunk'lara ayırır
 */
export function chunkAllContent(): ChunkData[] {
  const allChunks: ChunkData[] = [];

  // Kılavuz içeriği
  const guides = loadGuideContent();
  for (const guide of guides) {
    allChunks.push(...chunkGuideContent(guide));
  }

  // Cezalar
  const penalties = loadPenalties();
  for (const penalty of penalties) {
    allChunks.push(...chunkPenalty(penalty));
  }

  // Komutlar
  const commands = loadCommands();
  for (const command of commands) {
    allChunks.push(...chunkCommand(command));
  }

  // Prosedürler
  const procedures = loadProcedures();
  for (const procedure of procedures) {
    allChunks.push(...chunkProcedure(procedure));
  }

  return allChunks;
}


/**
 * Vector store'u başlatır ve tüm içeriği indeksler
 * @param useMockEmbeddings - Test için mock embedding kullan
 */
export async function initializeVectorStore(
  useMockEmbeddings = false
): Promise<void> {
  if (isInitialized) {
    return;
  }

  const chunks = chunkAllContent();

  if (useMockEmbeddings || !isOpenAIAvailable()) {
    // Mock embeddings kullan (test veya API key yoksa)
    vectorStore = chunks.map((chunk) => ({
      ...chunk,
      embedding: createMockEmbedding(chunk.content),
    }));
  } else {
    // Gerçek OpenAI embeddings kullan
    const contents = chunks.map((c) => c.content);
    const embeddings = await createEmbeddings(contents);

    vectorStore = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index] || [],
    }));
  }

  isInitialized = true;
}

/**
 * Vector store'u sıfırlar (test için)
 */
export function resetVectorStore(): void {
  vectorStore = [];
  isInitialized = false;
}

/**
 * Vector store'un başlatılıp başlatılmadığını kontrol eder
 */
export function isVectorStoreInitialized(): boolean {
  return isInitialized;
}

/**
 * Vector store'daki chunk sayısını döndürür
 */
export function getVectorStoreSize(): number {
  return vectorStore.length;
}

/**
 * Sorgu için en benzer chunk'ları arar
 * @param query - Arama sorgusu
 * @param topK - Döndürülecek maksimum sonuç sayısı
 * @param minSimilarity - Minimum benzerlik skoru (0-1)
 * @param useMockEmbedding - Test için mock embedding kullan
 */
export async function searchSimilar(
  query: string,
  topK = 5,
  minSimilarity = 0.3,
  useMockEmbedding = false
): Promise<VectorSearchResult[]> {
  if (!isInitialized) {
    await initializeVectorStore(useMockEmbedding);
  }

  if (!query || query.trim().length === 0) {
    return [];
  }

  // Sorgu için embedding oluştur
  let queryEmbedding: number[];
  if (useMockEmbedding || !isOpenAIAvailable()) {
    queryEmbedding = createMockEmbedding(query);
  } else {
    queryEmbedding = await createEmbedding(query);
  }

  // Tüm chunk'larla benzerlik hesapla
  const results: VectorSearchResult[] = vectorStore
    .map((chunk) => ({
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((result) => result.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

/**
 * Belirli bir kaynak tipine göre arama yapar
 */
export async function searchBySourceType(
  query: string,
  sourceType: 'guide' | 'penalty' | 'command' | 'procedure',
  topK = 5,
  useMockEmbedding = false
): Promise<VectorSearchResult[]> {
  const allResults = await searchSimilar(query, topK * 2, 0.2, useMockEmbedding);

  return allResults
    .filter((result) => result.chunk.sourceType === sourceType)
    .slice(0, topK);
}

/**
 * Chunk ID'sine göre chunk getirir
 */
export function getChunkById(chunkId: string): ContentChunk | null {
  return vectorStore.find((chunk) => chunk.id === chunkId) || null;
}

/**
 * Kaynak ID'sine göre tüm chunk'ları getirir
 */
export function getChunksBySourceId(sourceId: string): ContentChunk[] {
  return vectorStore.filter((chunk) => chunk.sourceId === sourceId);
}

/**
 * Anahtar kelimeye göre chunk'ları filtreler
 */
export function filterByKeyword(keyword: string): ContentChunk[] {
  const lowerKeyword = keyword.toLowerCase();
  return vectorStore.filter((chunk) =>
    chunk.metadata.keywords.some((k) => k.toLowerCase().includes(lowerKeyword))
  );
}

/**
 * Vector store istatistiklerini döndürür
 */
export function getVectorStoreStats(): {
  totalChunks: number;
  bySourceType: Record<string, number>;
  byCategory: Record<string, number>;
  averageChunkLength: number;
} {
  const bySourceType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let totalLength = 0;

  for (const chunk of vectorStore) {
    // Source type sayımı
    bySourceType[chunk.sourceType] = (bySourceType[chunk.sourceType] || 0) + 1;

    // Category sayımı
    const category = chunk.metadata.category;
    byCategory[category] = (byCategory[category] || 0) + 1;

    // Toplam uzunluk
    totalLength += chunk.content.length;
  }

  return {
    totalChunks: vectorStore.length,
    bySourceType,
    byCategory,
    averageChunkLength:
      vectorStore.length > 0 ? Math.round(totalLength / vectorStore.length) : 0,
  };
}

/**
 * RAG context oluşturur (AI için)
 * En benzer chunk'ları birleştirerek context string döndürür
 */
export async function buildRAGContext(
  query: string,
  maxTokens = 2000,
  useMockEmbedding = false
): Promise<{ context: string; sources: string[] }> {
  const results = await searchSimilar(query, 10, 0.3, useMockEmbedding);

  let context = '';
  const sources: string[] = [];
  const seenSources = new Set<string>();

  // Yaklaşık token hesabı (4 karakter = 1 token)
  const maxChars = maxTokens * 4;

  for (const result of results) {
    const chunkText = `[${result.chunk.metadata.title}]\n${result.chunk.content}\n\n`;

    if (context.length + chunkText.length > maxChars) {
      break;
    }

    context += chunkText;

    // Kaynak ekle (tekrar etmeden)
    if (!seenSources.has(result.chunk.sourceId)) {
      seenSources.add(result.chunk.sourceId);
      sources.push(result.chunk.metadata.title);
    }
  }

  return { context: context.trim(), sources };
}
