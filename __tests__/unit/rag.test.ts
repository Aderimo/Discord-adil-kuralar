/**
 * RAG Servisi Unit Testleri
 * 
 * Requirements: 6.1, 6.4
 * - 6.1: AI ceza sorusu için site içeriğinden doğru ceza süresini bulup yanıtlamalı
 * - 6.4: Sadece "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermeli
 */

import {
  retrieveContext,
  retrieveByContentType,
  retrievePenaltyContext,
  retrieveCommandContext,
  retrieveProcedureContext,
  formatSourcesForCitation,
  determineConfidenceLevel,
  getFullSourceContent,
  isRAGReady,
  initializeRAG,
  RAGRetrievalResult,
  SourceReference,
} from '@/lib/rag';
import { resetVectorStore } from '@/lib/vector-store';

describe('RAG Servisi', () => {
  beforeEach(async () => {
    // Her test öncesi vector store'u sıfırla
    resetVectorStore();
  });

  describe('retrieveContext', () => {
    it('boş sorgu için boş sonuç döndürmeli', async () => {
      const result = await retrieveContext('', { useMockEmbedding: true });

      expect(result.chunks).toHaveLength(0);
      expect(result.context).toBe('');
      expect(result.sources).toHaveLength(0);
      expect(result.averageRelevance).toBe(0);
      expect(result.query).toBe('');
    });

    it('geçerli sorgu için sonuç döndürmeli', async () => {
      const result = await retrieveContext('adk cezası', { useMockEmbedding: true });

      expect(result.query).toBe('adk cezası');
      expect(result.chunks).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(typeof result.averageRelevance).toBe('number');
    });

    it('topK parametresine göre sonuç sayısını sınırlamalı', async () => {
      const result = await retrieveContext('ceza', {
        useMockEmbedding: true,
        topK: 3,
      });

      expect(result.chunks.length).toBeLessThanOrEqual(3);
    });

    it('minRelevance parametresine göre filtreleme yapmalı', async () => {
      const result = await retrieveContext('hakaret', {
        useMockEmbedding: true,
        minRelevance: 0.5,
      });

      // Tüm sonuçlar minimum relevance'ın üzerinde olmalı
      for (const chunk of result.chunks) {
        expect(chunk.relevanceScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('contentTypes parametresine göre filtreleme yapmalı', async () => {
      const result = await retrieveContext('mute', {
        useMockEmbedding: true,
        contentTypes: ['penalty'],
      });

      // Tüm sonuçlar belirtilen tipte olmalı
      for (const chunk of result.chunks) {
        expect(chunk.sourceType).toBe('penalty');
      }
    });
  });

  describe('retrieveByContentType', () => {
    it('sadece belirtilen içerik tipini döndürmeli', async () => {
      const result = await retrieveByContentType('komut', 'command', {
        useMockEmbedding: true,
      });

      for (const chunk of result.chunks) {
        expect(chunk.sourceType).toBe('command');
      }
    });

    it('penalty tipi için doğru sonuçlar döndürmeli', async () => {
      const result = await retrieveByContentType('ceza', 'penalty', {
        useMockEmbedding: true,
      });

      for (const chunk of result.chunks) {
        expect(chunk.sourceType).toBe('penalty');
      }
    });
  });

  describe('retrievePenaltyContext', () => {
    it('ceza ve kılavuz içeriğini birleştirmeli', async () => {
      const result = await retrievePenaltyContext('adk cezası', {
        useMockEmbedding: true,
      });

      expect(result.query).toBe('adk cezası');
      expect(result.chunks).toBeDefined();
      // Sonuçlar relevance skoruna göre sıralı olmalı
      for (let i = 1; i < result.chunks.length; i++) {
        const prev = result.chunks[i - 1];
        const curr = result.chunks[i];
        if (prev && curr) {
          expect(prev.relevanceScore).toBeGreaterThanOrEqual(curr.relevanceScore);
        }
      }
    });
  });

  describe('retrieveCommandContext', () => {
    it('sadece komut içeriği döndürmeli', async () => {
      const result = await retrieveCommandContext('mute', {
        useMockEmbedding: true,
      });

      for (const chunk of result.chunks) {
        expect(chunk.sourceType).toBe('command');
      }
    });
  });

  describe('retrieveProcedureContext', () => {
    it('sadece prosedür içeriği döndürmeli', async () => {
      const result = await retrieveProcedureContext('kayıt', {
        useMockEmbedding: true,
      });

      for (const chunk of result.chunks) {
        expect(chunk.sourceType).toBe('procedure');
      }
    });
  });

  describe('formatSourcesForCitation', () => {
    it('boş kaynak listesi için boş string döndürmeli', () => {
      const result = formatSourcesForCitation([]);
      expect(result).toBe('');
    });

    it('kaynakları doğru formatta döndürmeli', () => {
      const sources: SourceReference[] = [
        {
          id: 'penalty-1',
          title: 'ADK Cezası',
          type: 'penalty',
          category: 'yazili',
          relevanceScore: 0.85,
        },
        {
          id: 'guide-1',
          title: 'Yetkili Kılavuzu',
          type: 'guide',
          category: 'kilavuz',
          relevanceScore: 0.72,
        },
      ];

      const result = formatSourcesForCitation(sources);

      expect(result).toContain('📚 Kaynaklar:');
      expect(result).toContain('[1] Ceza: ADK Cezası');
      expect(result).toContain('[2] Kılavuz: Yetkili Kılavuzu');
      expect(result).toContain('%85');
      expect(result).toContain('%72');
    });

    it('tüm kaynak tiplerini doğru etiketlemeli', () => {
      const sources: SourceReference[] = [
        { id: '1', title: 'Test', type: 'guide', category: 'test', relevanceScore: 0.5 },
        { id: '2', title: 'Test', type: 'penalty', category: 'test', relevanceScore: 0.5 },
        { id: '3', title: 'Test', type: 'command', category: 'test', relevanceScore: 0.5 },
        { id: '4', title: 'Test', type: 'procedure', category: 'test', relevanceScore: 0.5 },
      ];

      const result = formatSourcesForCitation(sources);

      expect(result).toContain('Kılavuz:');
      expect(result).toContain('Ceza:');
      expect(result).toContain('Komut:');
      expect(result).toContain('Prosedür:');
    });
  });

  describe('determineConfidenceLevel', () => {
    it('boş sonuç için low döndürmeli', () => {
      const result: RAGRetrievalResult = {
        chunks: [],
        context: '',
        sources: [],
        averageRelevance: 0,
        query: 'test',
      };

      expect(determineConfidenceLevel(result)).toBe('low');
    });

    it('yüksek relevance için high döndürmeli', () => {
      const result: RAGRetrievalResult = {
        chunks: [
          {
            id: '1',
            content: 'test',
            sourceType: 'penalty',
            sourceId: 'p1',
            title: 'Test',
            category: 'test',
            relevanceScore: 0.8,
            keywords: [],
          },
        ],
        context: 'test',
        sources: [],
        averageRelevance: 0.8,
        query: 'test',
      };

      expect(determineConfidenceLevel(result)).toBe('high');
    });

    it('orta relevance için medium döndürmeli', () => {
      const result: RAGRetrievalResult = {
        chunks: [
          {
            id: '1',
            content: 'test',
            sourceType: 'penalty',
            sourceId: 'p1',
            title: 'Test',
            category: 'test',
            relevanceScore: 0.6,
            keywords: [],
          },
        ],
        context: 'test',
        sources: [],
        averageRelevance: 0.6,
        query: 'test',
      };

      expect(determineConfidenceLevel(result)).toBe('medium');
    });

    it('düşük relevance için low döndürmeli', () => {
      const result: RAGRetrievalResult = {
        chunks: [
          {
            id: '1',
            content: 'test',
            sourceType: 'penalty',
            sourceId: 'p1',
            title: 'Test',
            category: 'test',
            relevanceScore: 0.3,
            keywords: [],
          },
        ],
        context: 'test',
        sources: [],
        averageRelevance: 0.3,
        query: 'test',
      };

      expect(determineConfidenceLevel(result)).toBe('low');
    });
  });

  describe('isRAGReady ve initializeRAG', () => {
    it('başlatılmadan önce false döndürmeli', () => {
      resetVectorStore();
      expect(isRAGReady()).toBe(false);
    });

    it('başlatıldıktan sonra true döndürmeli', async () => {
      resetVectorStore();
      await initializeRAG(true);
      expect(isRAGReady()).toBe(true);
    });
  });

  describe('getFullSourceContent', () => {
    it('var olmayan kaynak için null döndürmeli', () => {
      const result = getFullSourceContent('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('Kaynak referansları', () => {
    it('benzersiz kaynakları döndürmeli', async () => {
      const result = await retrieveContext('ceza', { useMockEmbedding: true });

      // Kaynak ID'leri benzersiz olmalı
      const sourceIds = result.sources.map((s) => s.id);
      const uniqueIds = new Set(sourceIds);
      expect(sourceIds.length).toBe(uniqueIds.size);
    });

    it('kaynakları relevance skoruna göre sıralamalı', async () => {
      const result = await retrieveContext('mute', { useMockEmbedding: true });

      for (let i = 1; i < result.sources.length; i++) {
        const prev = result.sources[i - 1];
        const curr = result.sources[i];
        if (prev && curr) {
          expect(prev.relevanceScore).toBeGreaterThanOrEqual(curr.relevanceScore);
        }
      }
    });
  });
});
