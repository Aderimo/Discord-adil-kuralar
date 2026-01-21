/**
 * AI Assistant Unit Tests
 * AI sohbet servisi için unit testler
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import {
  chat,
  createPenaltyRecord,
  createSimplePenaltyRecord,
  calculateConfidenceScore,
  getConfidenceLevel,
  isAIServiceAvailable,
  type ChatRequest,
  type PenaltyRecord,
} from '@/lib/ai-assistant';
import { type RAGRetrievalResult } from '@/lib/rag';

// Mock RAG module
jest.mock('@/lib/rag', () => ({
  retrievePenaltyContext: jest.fn(),
  retrieveContext: jest.fn(),
  determineConfidenceLevel: jest.fn(),
  formatSourcesForCitation: jest.fn(() => '\n\n📚 Kaynaklar:\n[1] Test Kaynak'),
}));

// Mock vector-store module
jest.mock('@/lib/vector-store', () => ({
  initializeVectorStore: jest.fn(),
  isVectorStoreInitialized: jest.fn(() => true),
  searchSimilar: jest.fn(() => []),
}));

import {
  retrievePenaltyContext,
  retrieveContext,
  determineConfidenceLevel,
} from '@/lib/rag';

const mockRetrievePenaltyContext = retrievePenaltyContext as jest.MockedFunction<
  typeof retrievePenaltyContext
>;
const mockRetrieveContext = retrieveContext as jest.MockedFunction<
  typeof retrieveContext
>;
const mockDetermineConfidenceLevel = determineConfidenceLevel as jest.MockedFunction<
  typeof determineConfidenceLevel
>;

describe('AI Assistant Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    const mockHighConfidenceResult: RAGRetrievalResult = {
      chunks: [
        {
          id: 'chunk-1',
          content: 'ADK (Aşırı Duygu Kontrolü) ihlali için 7 gün mute cezası verilir.',
          sourceType: 'penalty',
          sourceId: 'penalty-adk',
          title: 'ADK Cezası',
          category: 'yazili',
          relevanceScore: 0.85,
          keywords: ['adk', 'mute', 'ceza'],
        },
      ],
      context: 'ADK (Aşırı Duygu Kontrolü) ihlali için 7 gün mute cezası verilir.',
      sources: [
        {
          id: 'penalty-adk',
          title: 'ADK Cezası',
          type: 'penalty',
          category: 'yazili',
          relevanceScore: 0.85,
        },
      ],
      averageRelevance: 0.85,
      query: 'adk cezası',
    };

    const mockLowConfidenceResult: RAGRetrievalResult = {
      chunks: [],
      context: '',
      sources: [],
      averageRelevance: 0,
      query: 'bilinmeyen soru',
    };

    it('boş mesaj için hata döndürmeli', async () => {
      const request: ChatRequest = {
        message: '',
        useMock: true,
      };

      const response = await chat(request);

      expect(response.response).toBe('Lütfen bir soru veya mesaj girin.');
      expect(response.confidence).toBe('low');
      expect(response.contextUsed).toBe(false);
    });

    it('sadece boşluk içeren mesaj için hata döndürmeli', async () => {
      const request: ChatRequest = {
        message: '   ',
        useMock: true,
      };

      const response = await chat(request);

      expect(response.response).toBe('Lütfen bir soru veya mesaj girin.');
      expect(response.confidence).toBe('low');
    });

    it('ceza ile ilgili sorgu için retrievePenaltyContext kullanmalı', async () => {
      mockRetrievePenaltyContext.mockResolvedValue(mockHighConfidenceResult);
      mockDetermineConfidenceLevel.mockReturnValue('high');

      const request: ChatRequest = {
        message: 'adk cezası kaç gün?',
        useMock: true,
      };

      await chat(request);

      expect(mockRetrievePenaltyContext).toHaveBeenCalledWith('adk cezası kaç gün?', {
        useMockEmbedding: true,
      });
      expect(mockRetrieveContext).not.toHaveBeenCalled();
    });

    it('genel sorgu için retrieveContext kullanmalı', async () => {
      mockRetrieveContext.mockResolvedValue(mockHighConfidenceResult);
      mockDetermineConfidenceLevel.mockReturnValue('high');

      const request: ChatRequest = {
        message: 'yetkili kılavuzu nedir?',
        useMock: true,
      };

      await chat(request);

      expect(mockRetrieveContext).toHaveBeenCalledWith('yetkili kılavuzu nedir?', {
        useMockEmbedding: true,
      });
    });

    it('düşük güven durumunda üst yetkililere danışma mesajı vermeli (Requirement 6.5)', async () => {
      mockRetrieveContext.mockResolvedValue(mockLowConfidenceResult);
      mockDetermineConfidenceLevel.mockReturnValue('low');

      const request: ChatRequest = {
        message: 'bilinmeyen bir konu hakkında soru',
        useMock: true,
      };

      const response = await chat(request);

      expect(response.response).toContain('üst yetkililere danışılmalıdır');
      expect(response.confidence).toBe('low');
      expect(response.contextUsed).toBe(false);
    });

    it('yüksek güven durumunda context kullanmalı', async () => {
      mockRetrievePenaltyContext.mockResolvedValue(mockHighConfidenceResult);
      mockDetermineConfidenceLevel.mockReturnValue('high');

      const request: ChatRequest = {
        message: 'adk cezası nedir?',
        useMock: true,
      };

      const response = await chat(request);

      expect(response.contextUsed).toBe(true);
      expect(response.confidence).toBe('high');
      expect(response.sources.length).toBeGreaterThan(0);
    });

    it('kaynak referansları döndürmeli (Requirement 6.4)', async () => {
      mockRetrievePenaltyContext.mockResolvedValue(mockHighConfidenceResult);
      mockDetermineConfidenceLevel.mockReturnValue('high');

      const request: ChatRequest = {
        message: 'mute cezası',
        useMock: true,
      };

      const response = await chat(request);

      expect(response.sources).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.sources[0]).toHaveProperty('id');
      expect(response.sources[0]).toHaveProperty('title');
      expect(response.sources[0]).toHaveProperty('type');
    });
  });

  describe('createPenaltyRecord', () => {
    it('doğru formatta ceza kaydı oluşturmalı (Requirement 7.1, 7.2)', () => {
      const record = createPenaltyRecord({
        violation: 'ADK İhlali',
        article: 'Madde 3.2',
        duration: '7 gün',
        reason: 'Aşırı duygu kontrolü ihlali',
      });

      expect(record.violation).toBe('ADK İhlali');
      expect(record.article).toBe('Madde 3.2');
      expect(record.duration).toBe('7 gün');
      expect(record.reason).toBe('Aşırı duygu kontrolü ihlali');
      expect(record.copyableText).toContain('📋 CEZA KAYDI');
      expect(record.copyableText).toContain('İhlal: ADK İhlali');
      expect(record.copyableText).toContain('Madde: Madde 3.2');
      expect(record.copyableText).toContain('Süre: 7 gün');
      expect(record.copyableText).toContain('Gerekçe: Aşırı duygu kontrolü ihlali');
    });

    it('kopyalanabilir metin formatı doğru olmalı', () => {
      const record = createPenaltyRecord({
        violation: 'Hakaret',
        article: 'Madde 2.1',
        duration: '3 gün',
        reason: 'Kullanıcıya hakaret',
      });

      // Format kontrolü
      expect(record.copyableText).toMatch(/📋 CEZA KAYDI/);
      expect(record.copyableText).toMatch(/━+/);
      expect(record.copyableText).toMatch(/İhlal:/);
      expect(record.copyableText).toMatch(/Madde:/);
      expect(record.copyableText).toMatch(/Süre:/);
      expect(record.copyableText).toMatch(/Gerekçe:/);
    });

    it('tarih bilgisi içermeli', () => {
      const testDate = new Date('2024-01-15T10:30:00');
      const record = createPenaltyRecord({
        violation: 'Spam',
        article: 'Madde 4.1',
        duration: '1 gün',
        reason: 'Tekrarlı mesaj gönderimi',
        date: testDate,
      });

      expect(record.copyableText).toContain('Tarih:');
      expect(record.copyableText).toContain('15.01.2024');
    });

    it('ek notlar eklenebilmeli', () => {
      const record = createPenaltyRecord({
        violation: 'Reklam',
        article: 'Madde 5.1',
        duration: '7 gün',
        reason: 'İzinsiz reklam paylaşımı',
        notes: 'İlk ihlal, uyarı verildi',
      });

      expect(record.copyableText).toContain('Not: İlk ihlal, uyarı verildi');
    });

    it('boşlukları temizlemeli', () => {
      const record = createPenaltyRecord({
        violation: '  ADK İhlali  ',
        article: '  Madde 3.2  ',
        duration: '  7 gün  ',
        reason: '  Aşırı duygu kontrolü  ',
      });

      expect(record.violation).toBe('ADK İhlali');
      expect(record.article).toBe('Madde 3.2');
      expect(record.duration).toBe('7 gün');
      expect(record.reason).toBe('Aşırı duygu kontrolü');
    });

    it('boş ihlal türü için hata fırlatmalı', () => {
      expect(() => createPenaltyRecord({
        violation: '',
        article: 'Madde 1.1',
        duration: '1 gün',
        reason: 'Test',
      })).toThrow('İhlal türü zorunludur');
    });

    it('boş madde numarası için hata fırlatmalı', () => {
      expect(() => createPenaltyRecord({
        violation: 'Test İhlali',
        article: '',
        duration: '1 gün',
        reason: 'Test',
      })).toThrow('Madde numarası zorunludur');
    });

    it('boş süre için hata fırlatmalı', () => {
      expect(() => createPenaltyRecord({
        violation: 'Test İhlali',
        article: 'Madde 1.1',
        duration: '',
        reason: 'Test',
      })).toThrow('Ceza süresi zorunludur');
    });

    it('boş gerekçe için hata fırlatmalı', () => {
      expect(() => createPenaltyRecord({
        violation: 'Test İhlali',
        article: 'Madde 1.1',
        duration: '1 gün',
        reason: '',
      })).toThrow('Gerekçe zorunludur');
    });

    it('sadece boşluk içeren alanlar için hata fırlatmalı', () => {
      expect(() => createPenaltyRecord({
        violation: '   ',
        article: 'Madde 1.1',
        duration: '1 gün',
        reason: 'Test',
      })).toThrow('İhlal türü zorunludur');
    });

    it('Discord için uygun emoji formatı kullanmalı', () => {
      const record = createPenaltyRecord({
        violation: 'Küfür',
        article: 'Madde 2.3',
        duration: '3 gün',
        reason: 'Uygunsuz dil kullanımı',
      });

      // Discord emoji kontrolü
      expect(record.copyableText).toContain('📋');
      expect(record.copyableText).toContain('📅');
      expect(record.copyableText).toContain('⚠️');
      expect(record.copyableText).toContain('📖');
      expect(record.copyableText).toContain('⏱️');
      expect(record.copyableText).toContain('📝');
    });

    it('tüm gerekli alanları içermeli (Requirement 7.2)', () => {
      const record = createPenaltyRecord({
        violation: 'Test İhlali',
        article: 'Madde X.Y',
        duration: '5 gün',
        reason: 'Test gerekçesi',
      });

      // Gereksinim 7.2: ihlal türü, ceza süresi, madde numarası ve gerekçeyi içermeli
      expect(record.violation).toBeDefined();
      expect(record.violation.length).toBeGreaterThan(0);
      expect(record.duration).toBeDefined();
      expect(record.duration.length).toBeGreaterThan(0);
      expect(record.article).toBeDefined();
      expect(record.article.length).toBeGreaterThan(0);
      expect(record.reason).toBeDefined();
      expect(record.reason.length).toBeGreaterThan(0);
    });
  });

  describe('calculateConfidenceScore', () => {
    it('boş chunk listesi için 0 döndürmeli', () => {
      const result: RAGRetrievalResult = {
        chunks: [],
        context: '',
        sources: [],
        averageRelevance: 0,
        query: 'test',
      };

      expect(calculateConfidenceScore(result)).toBe(0);
    });

    it('yüksek relevance için yüksek skor döndürmeli', () => {
      const result: RAGRetrievalResult = {
        chunks: [
          {
            id: '1',
            content: 'test',
            sourceType: 'penalty',
            sourceId: 'p1',
            title: 'Test',
            category: 'yazili',
            relevanceScore: 0.9,
            keywords: [],
          },
          {
            id: '2',
            content: 'test2',
            sourceType: 'penalty',
            sourceId: 'p2',
            title: 'Test2',
            category: 'yazili',
            relevanceScore: 0.85,
            keywords: [],
          },
        ],
        context: 'test context',
        sources: [],
        averageRelevance: 0.875,
        query: 'test',
      };

      const score = calculateConfidenceScore(result);
      expect(score).toBeGreaterThan(0.7);
    });

    it('düşük relevance için düşük skor döndürmeli', () => {
      const result: RAGRetrievalResult = {
        chunks: [
          {
            id: '1',
            content: 'test',
            sourceType: 'guide',
            sourceId: 'g1',
            title: 'Test',
            category: 'kilavuz',
            relevanceScore: 0.3,
            keywords: [],
          },
        ],
        context: 'test',
        sources: [],
        averageRelevance: 0.3,
        query: 'test',
      };

      const score = calculateConfidenceScore(result);
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('getConfidenceLevel', () => {
    it('0.7 ve üzeri için high döndürmeli', () => {
      expect(getConfidenceLevel(0.7)).toBe('high');
      expect(getConfidenceLevel(0.8)).toBe('high');
      expect(getConfidenceLevel(1.0)).toBe('high');
    });

    it('0.4-0.7 arası için medium döndürmeli', () => {
      expect(getConfidenceLevel(0.4)).toBe('medium');
      expect(getConfidenceLevel(0.5)).toBe('medium');
      expect(getConfidenceLevel(0.69)).toBe('medium');
    });

    it('0.4 altı için low döndürmeli', () => {
      expect(getConfidenceLevel(0)).toBe('low');
      expect(getConfidenceLevel(0.2)).toBe('low');
      expect(getConfidenceLevel(0.39)).toBe('low');
    });
  });

  describe('isAIServiceAvailable', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('OPENAI_API_KEY varsa true döndürmeli', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      // Re-import to get fresh module
      const { isAIServiceAvailable: checkAvailable } = require('@/lib/ai-assistant');
      expect(checkAvailable()).toBe(true);
    });

    it('OPENAI_API_KEY yoksa false döndürmeli', () => {
      delete process.env.OPENAI_API_KEY;
      
      const { isAIServiceAvailable: checkAvailable } = require('@/lib/ai-assistant');
      expect(checkAvailable()).toBe(false);
    });
  });
});

describe('Penalty Related Query Detection', () => {
  // Bu testler chat fonksiyonunun ceza ile ilgili sorguları doğru tespit ettiğini doğrular

  beforeEach(() => {
    jest.clearAllMocks();
    mockRetrievePenaltyContext.mockResolvedValue({
      chunks: [
        {
          id: '1',
          content: 'Test ceza içeriği',
          sourceType: 'penalty',
          sourceId: 'p1',
          title: 'Test Ceza',
          category: 'yazili',
          relevanceScore: 0.8,
          keywords: [],
        },
      ],
      context: 'Test context',
      sources: [
        {
          id: 'p1',
          title: 'Test Ceza',
          type: 'penalty',
          category: 'yazili',
          relevanceScore: 0.8,
        },
      ],
      averageRelevance: 0.8,
      query: 'test',
    });
    mockRetrieveContext.mockResolvedValue({
      chunks: [
        {
          id: '1',
          content: 'Test içerik',
          sourceType: 'guide',
          sourceId: 'g1',
          title: 'Test Kılavuz',
          category: 'kilavuz',
          relevanceScore: 0.8,
          keywords: [],
        },
      ],
      context: 'Test context',
      sources: [
        {
          id: 'g1',
          title: 'Test Kılavuz',
          type: 'guide',
          category: 'kilavuz',
          relevanceScore: 0.8,
        },
      ],
      averageRelevance: 0.8,
      query: 'test',
    });
    mockDetermineConfidenceLevel.mockReturnValue('high');
  });

  const penaltyQueries = [
    'adk cezası kaç gün?',
    'hakaret için ne ceza verilir?',
    'mute süresi ne kadar?',
    'ban nasıl atılır?',
    'spam yapana ne olur?',
    'küfür cezası',
    'flood ihlali',
  ];

  const generalQueries = [
    'yetkili kılavuzu nedir?',
    'nasıl kayıt yapılır?',
    'prosedür adımları',
    'komut listesi',
  ];

  penaltyQueries.forEach((query) => {
    it(`"${query}" için retrievePenaltyContext kullanmalı`, async () => {
      await chat({ message: query, useMock: true });
      expect(mockRetrievePenaltyContext).toHaveBeenCalled();
    });
  });

  generalQueries.forEach((query) => {
    it(`"${query}" için retrieveContext kullanmalı`, async () => {
      await chat({ message: query, useMock: true });
      expect(mockRetrieveContext).toHaveBeenCalled();
    });
  });
});

describe('createSimplePenaltyRecord', () => {
  it('basit parametrelerle ceza kaydı oluşturmalı', () => {
    const record = createSimplePenaltyRecord(
      'Hakaret',
      'Madde 2.1',
      '3 gün',
      'Kullanıcıya hakaret'
    );

    expect(record.violation).toBe('Hakaret');
    expect(record.article).toBe('Madde 2.1');
    expect(record.duration).toBe('3 gün');
    expect(record.reason).toBe('Kullanıcıya hakaret');
    expect(record.copyableText).toContain('📋 CEZA KAYDI');
  });

  it('createPenaltyRecord ile aynı sonucu vermeli', () => {
    const simpleRecord = createSimplePenaltyRecord(
      'Spam',
      'Madde 4.1',
      '1 gün',
      'Tekrarlı mesaj'
    );

    const fullRecord = createPenaltyRecord({
      violation: 'Spam',
      article: 'Madde 4.1',
      duration: '1 gün',
      reason: 'Tekrarlı mesaj',
    });

    expect(simpleRecord.violation).toBe(fullRecord.violation);
    expect(simpleRecord.article).toBe(fullRecord.article);
    expect(simpleRecord.duration).toBe(fullRecord.duration);
    expect(simpleRecord.reason).toBe(fullRecord.reason);
  });
});
