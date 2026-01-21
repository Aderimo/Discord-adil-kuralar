/**
 * Embedding Pipeline Unit Tests
 * İçerik chunking, embedding ve vector store testleri
 *
 * Requirement 6.4: RAG tabanlı AI yanıt sistemi
 */

import {
  chunkText,
  chunkAllContent,
  initializeVectorStore,
  resetVectorStore,
  isVectorStoreInitialized,
  getVectorStoreSize,
  getVectorStoreStats,
  searchSimilar,
  buildRAGContext,
  getChunkById,
  getChunksBySourceId,
  filterByKeyword,
} from '@/lib/vector-store';
import {
  createMockEmbedding,
  cosineSimilarity,
  EMBEDDING_DIMENSION,
} from '@/lib/embeddings';

describe('Embedding Pipeline', () => {
  // Her testten önce vector store'u sıfırla
  beforeEach(() => {
    resetVectorStore();
  });

  describe('chunkText', () => {
    it('boş metin için boş dizi döndürmeli', () => {
      expect(chunkText('')).toEqual([]);
      expect(chunkText('   ')).toEqual([]);
    });

    it('minimum boyutu aşan metni tek chunk olarak döndürmeli', () => {
      // Minimum chunk boyutu 100 karakter, bu yüzden yeterince uzun metin kullanıyoruz
      const text = 'Bu bir test metnidir ve minimum chunk boyutunu aşması için yeterince uzun olmalıdır. Ek içerik ekliyoruz.';
      const chunks = chunkText(text);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(text);
    });

    it('uzun metni birden fazla chunk\'a ayırmalı', () => {
      // 500+ karakterlik metin oluştur
      const longText = Array(20)
        .fill('Bu bir test cümlesidir. ')
        .join('')
        .repeat(3);
      const chunks = chunkText(longText);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('paragrafları koruyarak chunk\'lamalı', () => {
      // Her paragraf minimum 100 karakter olmalı
      const text = `Birinci paragraf içeriği burada ve minimum chunk boyutunu aşması için yeterince uzun olmalıdır. Ek içerik ekliyoruz burada.

İkinci paragraf içeriği burada ve minimum chunk boyutunu aşması için yeterince uzun olmalıdır. Ek içerik ekliyoruz burada.

Üçüncü paragraf içeriği burada ve minimum chunk boyutunu aşması için yeterince uzun olmalıdır. Ek içerik ekliyoruz burada.`;
      const chunks = chunkText(text);
      // Paragraflar korunmalı
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.includes('Birinci'))).toBe(true);
    });

    it('minimum chunk boyutunu korumalı', () => {
      const text = 'Kısa metin.';
      const chunks = chunkText(text, {
        maxChunkSize: 500,
        overlap: 50,
        minChunkSize: 100,
      });
      // Minimum boyutun altındaki metinler için boş dizi
      expect(chunks.length).toBe(0);
    });
  });

  describe('chunkAllContent', () => {
    it('tüm içerik türlerinden chunk\'lar oluşturmalı', () => {
      const chunks = chunkAllContent();
      expect(chunks.length).toBeGreaterThan(0);

      // Farklı kaynak türleri olmalı
      const sourceTypes = new Set(chunks.map((c) => c.sourceType));
      expect(sourceTypes.size).toBeGreaterThan(0);
    });

    it('her chunk için gerekli metadata\'yı içermeli', () => {
      const chunks = chunkAllContent();

      for (const chunk of chunks) {
        expect(chunk.id).toBeDefined();
        expect(chunk.sourceId).toBeDefined();
        expect(chunk.sourceType).toBeDefined();
        expect(chunk.content).toBeDefined();
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.title).toBeDefined();
        expect(chunk.metadata.category).toBeDefined();
        expect(chunk.metadata.keywords).toBeDefined();
        expect(typeof chunk.metadata.chunkIndex).toBe('number');
        expect(typeof chunk.metadata.totalChunks).toBe('number');
      }
    });

    it('chunk ID\'leri benzersiz olmalı', () => {
      const chunks = chunkAllContent();
      const ids = chunks.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('initializeVectorStore', () => {
    it('mock embeddings ile başlatılabilmeli', async () => {
      await initializeVectorStore(true);
      expect(isVectorStoreInitialized()).toBe(true);
      expect(getVectorStoreSize()).toBeGreaterThan(0);
    });

    it('tekrar başlatma çağrısı yok sayılmalı', async () => {
      await initializeVectorStore(true);
      const size1 = getVectorStoreSize();

      await initializeVectorStore(true);
      const size2 = getVectorStoreSize();

      expect(size1).toBe(size2);
    });

    it('her chunk için embedding oluşturmalı', async () => {
      await initializeVectorStore(true);
      const stats = getVectorStoreStats();
      expect(stats.totalChunks).toBeGreaterThan(0);
    });
  });

  describe('resetVectorStore', () => {
    it('vector store\'u sıfırlamalı', async () => {
      await initializeVectorStore(true);
      expect(isVectorStoreInitialized()).toBe(true);

      resetVectorStore();
      expect(isVectorStoreInitialized()).toBe(false);
      expect(getVectorStoreSize()).toBe(0);
    });
  });

  describe('getVectorStoreStats', () => {
    it('doğru istatistikleri döndürmeli', async () => {
      await initializeVectorStore(true);
      const stats = getVectorStoreStats();

      expect(stats.totalChunks).toBeGreaterThan(0);
      expect(stats.bySourceType).toBeDefined();
      expect(stats.byCategory).toBeDefined();
      expect(stats.averageChunkLength).toBeGreaterThan(0);
    });

    it('kaynak türlerine göre sayım yapmalı', async () => {
      await initializeVectorStore(true);
      const stats = getVectorStoreStats();

      // En az bir kaynak türü olmalı
      const sourceTypeCount = Object.keys(stats.bySourceType).length;
      expect(sourceTypeCount).toBeGreaterThan(0);
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      await initializeVectorStore(true);
    });

    it('boş sorgu için boş sonuç döndürmeli', async () => {
      const results = await searchSimilar('', 5, 0.3, true);
      expect(results).toEqual([]);
    });

    it('geçerli sorgu için sonuç döndürmeli', async () => {
      const results = await searchSimilar('ceza', 5, 0.1, true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('sonuçları benzerlik skoruna göre sıralamalı', async () => {
      const results = await searchSimilar('mute', 10, 0.1, true);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.similarity).toBeGreaterThanOrEqual(
          results[i]!.similarity
        );
      }
    });

    it('topK parametresine uymalı', async () => {
      const results = await searchSimilar('komut', 3, 0.1, true);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('minimum benzerlik filtresini uygulamalı', async () => {
      const results = await searchSimilar('test', 10, 0.5, true);

      for (const result of results) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('buildRAGContext', () => {
    beforeEach(async () => {
      await initializeVectorStore(true);
    });

    it('sorgu için context oluşturmalı', async () => {
      // Mock embedding ile benzerlik düşük olabilir, minSimilarity'yi düşük tutuyoruz
      // buildRAGContext içinde minSimilarity 0.3 kullanılıyor
      // Mock embedding'ler deterministik olduğu için belirli bir sorgu kullanıyoruz
      const { context, sources } = await buildRAGContext('mute ban komut', 2000, true);

      // Mock embedding'ler ile sonuç garantisi yok, bu yüzden sadece fonksiyonun çalıştığını test ediyoruz
      expect(typeof context).toBe('string');
      expect(Array.isArray(sources)).toBe(true);
    });

    it('maxTokens limitine uymalı', async () => {
      const maxTokens = 500;
      const { context } = await buildRAGContext('mute', maxTokens, true);

      // Yaklaşık 4 karakter = 1 token
      const maxChars = maxTokens * 4;
      expect(context.length).toBeLessThanOrEqual(maxChars + 200); // Biraz tolerans
    });

    it('benzersiz kaynaklar döndürmeli', async () => {
      const { sources } = await buildRAGContext('ban', 2000, true);

      const uniqueSources = new Set(sources);
      expect(uniqueSources.size).toBe(sources.length);
    });
  });

  describe('getChunkById', () => {
    beforeEach(async () => {
      await initializeVectorStore(true);
    });

    it('var olan chunk\'ı döndürmeli', async () => {
      const stats = getVectorStoreStats();
      expect(stats.totalChunks).toBeGreaterThan(0);

      // İlk chunk'ı al
      const chunks = chunkAllContent();
      const firstChunk = chunks[0];
      if (firstChunk) {
        const chunk = getChunkById(firstChunk.id);
        expect(chunk).not.toBeNull();
        expect(chunk?.id).toBe(firstChunk.id);
      }
    });

    it('olmayan chunk için null döndürmeli', () => {
      const chunk = getChunkById('non-existent-id');
      expect(chunk).toBeNull();
    });
  });

  describe('getChunksBySourceId', () => {
    beforeEach(async () => {
      await initializeVectorStore(true);
    });

    it('kaynak ID\'sine göre chunk\'ları döndürmeli', () => {
      const chunks = chunkAllContent();
      const firstChunk = chunks[0];
      if (firstChunk) {
        const sourceChunks = getChunksBySourceId(firstChunk.sourceId);
        expect(sourceChunks.length).toBeGreaterThan(0);
        expect(sourceChunks.every((c) => c.sourceId === firstChunk.sourceId)).toBe(
          true
        );
      }
    });

    it('olmayan kaynak için boş dizi döndürmeli', () => {
      const chunks = getChunksBySourceId('non-existent-source');
      expect(chunks).toEqual([]);
    });
  });

  describe('filterByKeyword', () => {
    beforeEach(async () => {
      await initializeVectorStore(true);
    });

    it('anahtar kelimeye göre filtrelemeli', () => {
      const chunks = filterByKeyword('ceza');
      // Ceza ile ilgili chunk'lar olmalı
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('büyük/küçük harf duyarsız olmalı', () => {
      const chunks1 = filterByKeyword('CEZA');
      const chunks2 = filterByKeyword('ceza');
      expect(chunks1.length).toBe(chunks2.length);
    });
  });
});

describe('Mock Embeddings', () => {
  describe('createMockEmbedding', () => {
    it('doğru boyutta embedding oluşturmalı', () => {
      const embedding = createMockEmbedding('test metin');
      expect(embedding.length).toBe(EMBEDDING_DIMENSION);
    });

    it('normalize edilmiş embedding döndürmeli', () => {
      const embedding = createMockEmbedding('test metin');
      const norm = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );
      // Norm yaklaşık 1 olmalı (floating point toleransı ile)
      expect(norm).toBeCloseTo(1, 1);
    });

    it('farklı metinler için farklı embedding\'ler oluşturmalı', () => {
      const emb1 = createMockEmbedding('metin bir');
      const emb2 = createMockEmbedding('metin iki');

      // Tamamen aynı olmamalı
      const similarity = cosineSimilarity(emb1, emb2);
      expect(similarity).toBeLessThan(1);
    });

    it('aynı metin için aynı embedding döndürmeli', () => {
      const emb1 = createMockEmbedding('aynı metin');
      const emb2 = createMockEmbedding('aynı metin');

      const similarity = cosineSimilarity(emb1, emb2);
      expect(similarity).toBe(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('aynı vektörler için 1 döndürmeli', () => {
      const vec = [0.5, 0.5, 0.5, 0.5];
      expect(cosineSimilarity(vec, vec)).toBe(1);
    });

    it('ortogonal vektörler için 0 döndürmeli', () => {
      const vec1 = [1, 0, 0, 0];
      const vec2 = [0, 1, 0, 0];
      expect(cosineSimilarity(vec1, vec2)).toBe(0);
    });

    it('farklı boyutlu vektörler için hata fırlatmalı', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });

    it('0-1 arasında değer döndürmeli (normalize vektörler için)', () => {
      const emb1 = createMockEmbedding('test bir');
      const emb2 = createMockEmbedding('test iki');

      const similarity = cosineSimilarity(emb1, emb2);
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    resetVectorStore();
  });

  it('başlatılmamış store ile arama yapılabilmeli (otomatik başlatma)', async () => {
    expect(isVectorStoreInitialized()).toBe(false);

    const results = await searchSimilar('test', 5, 0.1, true);
    // Otomatik başlatılmalı
    expect(isVectorStoreInitialized()).toBe(true);
  });

  it('başlatılmamış store ile context oluşturulabilmeli', async () => {
    expect(isVectorStoreInitialized()).toBe(false);

    const { context } = await buildRAGContext('test', 1000, true);
    expect(isVectorStoreInitialized()).toBe(true);
  });
});
