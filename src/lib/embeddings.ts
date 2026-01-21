/**
 * OpenAI Embeddings Servisi
 * İçerik için embedding vektörleri oluşturur
 *
 * Requirement 6.4: RAG tabanlı AI yanıt sistemi
 */

import OpenAI from 'openai';

// OpenAI client - lazy initialization
let openaiClient: OpenAI | null = null;

/**
 * OpenAI client'ı döndürür (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. ' +
        'Please add it to your .env file.'
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Embedding modeli
 * text-embedding-3-small: Hızlı ve ekonomik, 1536 boyutlu vektör
 */
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Embedding boyutu
 */
export const EMBEDDING_DIMENSION = 1536;

/**
 * Tek bir metin için embedding oluşturur
 * @param text - Embedding oluşturulacak metin
 * @returns Embedding vektörü (number[])
 */
export async function createEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const client = getOpenAIClient();

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding returned from OpenAI API');
    }

    return embedding;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Birden fazla metin için toplu embedding oluşturur
 * @param texts - Embedding oluşturulacak metinler
 * @returns Embedding vektörleri dizisi
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Boş metinleri filtrele
  const validTexts = texts.filter((t) => t && t.trim().length > 0);
  if (validTexts.length === 0) {
    return [];
  }

  const client = getOpenAIClient();

  try {
    // OpenAI API batch limit: 2048 inputs per request
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);
      
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map((t) => t.trim()),
      });

      // Sıralı olarak embedding'leri ekle
      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);

      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * İki vektör arasındaki cosine similarity hesaplar
 * @param a - İlk vektör
 * @param b - İkinci vektör
 * @returns Benzerlik skoru (0-1, 1 = tam eşleşme)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * OpenAI API'nin kullanılabilir olup olmadığını kontrol eder
 * @returns API kullanılabilir mi
 */
export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Test için mock embedding oluşturur (API olmadan)
 * @param text - Metin
 * @returns Mock embedding vektörü
 */
export function createMockEmbedding(text: string): number[] {
  // Basit bir hash-based mock embedding
  const embedding = new Array(EMBEDDING_DIMENSION).fill(0);
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const index = (charCode * (i + 1)) % EMBEDDING_DIMENSION;
    embedding[index] = (embedding[index] + charCode / 255) % 1;
  }

  // Normalize et
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}
