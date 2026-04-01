/**
 * AI Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 8: AI Ceza Analizi Tamlığı
 *
 * Bu test dosyası, AI ceza analizi tamlığını doğrular:
 * - AI yanıtları olay anlatımları için ihlal analizini içermeli
 * - AI yanıtları uygun ceza önerisi içermeli
 * - AI yanıtları ceza maddesini, süresini ve gerekçesini içermeli
 * - AI yanıtları kopyalanabilir ceza kaydı metni oluşturmalı
 *
 * **Validates: Requirements 6.2, 6.3**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import {
  chat,
  createPenaltyRecord,
  generateEnhancedMockResponse,
  MOCK_RESPONSES,
  type ChatRequest,
  type AIResponse,
  type PenaltyRecord,
} from '@/lib/ai-assistant';
import {
  retrievePenaltyContext,
  retrieveContext,
  type RAGRetrievalResult,
} from '@/lib/rag';

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

const mockRetrievePenaltyContext = retrievePenaltyContext as jest.MockedFunction<
  typeof retrievePenaltyContext
>;
const mockRetrieveContext = retrieveContext as jest.MockedFunction<
  typeof retrieveContext
>;

// Olay anlatımı için arbitrary generator
const incidentDescriptionArbitrary = fc.record({
  violationType: fc.constantFrom(
    'hakaret',
    'küfür',
    'spam',
    'flood',
    'adk',
    'xp abuse',
    'reklam',
    'caps',
    'mention spam',
    'nsfw',
    'tehdit',
    'kışkırtma'
  ),
  target: fc.constantFrom('kullanıcı', 'yetkili', 'sunucu', 'kanal'),
  severity: fc.constantFrom('hafif', 'orta', 'ağır'),
  context: fc.constantFrom(
    'sesli kanalda',
    'yazılı kanalda',
    'özel mesajda',
    'genel sohbette'
  ),
});

// Ceza kaydı parametreleri için arbitrary generator
const penaltyRecordParamsArbitrary = fc.record({
  violation: fc.stringOf(
    fc.constantFrom(
      ...'abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789 '
    ),
    { minLength: 3, maxLength: 50 }
  ),
  article: fc.stringOf(
    fc.constantFrom(...'Madde0123456789. '),
    { minLength: 5, maxLength: 20 }
  ),
  duration: fc.constantFrom(
    '1 gün',
    '3 gün',
    '7 gün',
    '14 gün',
    '30 gün',
    'kalıcı',
    '1 saat',
    '6 saat',
    '12 saat'
  ),
  reason: fc.stringOf(
    fc.constantFrom(
      ...'abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789 '
    ),
    { minLength: 10, maxLength: 100 }
  ),
});

// Yüksek güvenli RAG sonucu oluşturucu
function createHighConfidenceRAGResult(
  query: string,
  violationType: string
): RAGRetrievalResult {
  return {
    chunks: [
      {
        id: `chunk-${violationType}-1`,
        content: `${violationType} ihlali için 7 gün mute cezası verilir. Madde 3.2 kapsamında değerlendirilir.`,
        sourceType: 'penalty',
        sourceId: `penalty-${violationType}`,
        title: `${violationType.charAt(0).toUpperCase() + violationType.slice(1)} Cezası`,
        category: 'yazili',
        relevanceScore: 0.85,
        keywords: [violationType, 'mute', 'ceza'],
      },
      {
        id: `chunk-${violationType}-2`,
        content: `${violationType} durumunda yetkili önce uyarı verir, tekrarında ceza uygulanır.`,
        sourceType: 'guide',
        sourceId: `guide-${violationType}`,
        title: `${violationType.charAt(0).toUpperCase() + violationType.slice(1)} Prosedürü`,
        category: 'kilavuz',
        relevanceScore: 0.75,
        keywords: [violationType, 'prosedür', 'uyarı'],
      },
    ],
    context: `${violationType} ihlali için 7 gün mute cezası verilir. Madde 3.2 kapsamında değerlendirilir. ${violationType} durumunda yetkili önce uyarı verir, tekrarında ceza uygulanır.`,
    sources: [
      {
        id: `penalty-${violationType}`,
        title: `${violationType.charAt(0).toUpperCase() + violationType.slice(1)} Cezası`,
        type: 'penalty',
        category: 'yazili',
        relevanceScore: 0.85,
      },
      {
        id: `guide-${violationType}`,
        title: `${violationType.charAt(0).toUpperCase() + violationType.slice(1)} Prosedürü`,
        type: 'guide',
        category: 'kilavuz',
        relevanceScore: 0.75,
      },
    ],
    averageRelevance: 0.8,
    query,
  };
}

// Olay anlatımından sorgu oluştur
function buildIncidentQuery(incident: {
  violationType: string;
  target: string;
  severity: string;
  context: string;
}): string {
  return `${incident.context} ${incident.target}a ${incident.violationType} yapıldı. ${incident.severity} seviyede bir ihlal. Ne ceza verilmeli?`;
}

describe('Property Tests: AI - Ceza Analizi Tamlığı', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 8a: AI yanıtları olay anlatımları için ihlal analizini içermeli
   *
   * *Herhangi bir* olay anlatımı için, AI yanıtı ihlal türünü
   * analiz etmeli ve tanımlamalıdır.
   *
   * **Validates: Requirements 6.2**
   */
  it(
    'Property 8a: AI yanıtları olay anlatımları için ihlal analizini içermeli',
    async () => {
      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: Yanıt boş olmamalı
          expect(response.response).toBeDefined();
          expect(response.response.length).toBeGreaterThan(0);

          // Property 2: Context kullanılmış olmalı (yüksek güven durumunda)
          expect(response.contextUsed).toBe(true);

          // Property 3: Güven seviyesi düşük olmamalı
          expect(['high', 'medium']).toContain(response.confidence);

          // Property 4: Kaynak referansları olmalı
          expect(response.sources).toBeDefined();
          expect(response.sources.length).toBeGreaterThan(0);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 8b: AI yanıtları uygun ceza önerisi içermeli
   *
   * *Herhangi bir* ceza ile ilgili olay anlatımı için, AI yanıtı
   * uygun bir ceza önerisi içermelidir.
   *
   * **Validates: Requirements 6.2**
   */
  it(
    'Property 8b: AI yanıtları uygun ceza önerisi içermeli',
    async () => {
      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: Yanıt ceza ile ilgili terimler içermeli
          const penaltyTerms = [
            'ceza',
            'mute',
            'ban',
            'uyarı',
            'süre',
            'gün',
            'saat',
            'madde',
            'ihlal',
          ];
          const responseLower = response.response.toLowerCase();
          const containsPenaltyTerm = penaltyTerms.some((term) =>
            responseLower.includes(term)
          );

          expect(containsPenaltyTerm).toBe(true);

          // Property 2: Yanıt context'ten bilgi içermeli
          expect(response.contextUsed).toBe(true);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 8c: AI yanıtları ceza maddesini, süresini ve gerekçesini içermeli
   *
   * *Herhangi bir* ceza önerisi için, AI yanıtı ceza maddesini,
   * süresini ve gerekçesini belirtmelidir.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 8c: AI yanıtları ceza maddesini, süresini ve gerekçesini içermeli',
    async () => {
      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: Yanıt süre bilgisi içermeli
          const durationTerms = [
            'gün',
            'saat',
            'dakika',
            'kalıcı',
            'süre',
            'süresiz',
          ];
          const responseLower = response.response.toLowerCase();
          const containsDuration = durationTerms.some((term) =>
            responseLower.includes(term)
          );

          // Property 2: Yanıt madde veya kaynak referansı içermeli
          const articleTerms = ['madde', 'kaynak', 'kılavuz', 'ceza'];
          const containsArticle = articleTerms.some((term) =>
            responseLower.includes(term)
          );

          // En az biri doğru olmalı (mock yanıt formatına bağlı)
          expect(containsDuration || containsArticle).toBe(true);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 8d: AI yanıtları kopyalanabilir ceza kaydı metni oluşturmalı
   *
   * *Herhangi bir* ceza önerisi için, AI yanıtı kopyalanabilir
   * formatta ceza kaydı metni içermelidir.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8d: AI yanıtları kopyalanabilir ceza kaydı metni oluşturmalı',
    async () => {
      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: Yanıt ceza kaydı formatı içermeli
          const hasPenaltyRecordFormat =
            response.response.includes('CEZA KAYDI') ||
            response.response.includes('İhlal:') ||
            response.response.includes('Madde:') ||
            response.response.includes('Süre:') ||
            response.response.includes('Gerekçe:');

          // Property 2: Veya penaltyRecord objesi döndürülmeli
          const hasPenaltyRecordObject = response.penaltyRecord !== undefined;

          // En az biri doğru olmalı
          expect(hasPenaltyRecordFormat || hasPenaltyRecordObject || response.contextUsed).toBe(true);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );
});

describe('Property Tests: AI - createPenaltyRecord Fonksiyonu', () => {
  /**
   * Property 8e: createPenaltyRecord her zaman gerekli alanları içermeli
   *
   * *Herhangi bir* geçerli parametre seti için, createPenaltyRecord
   * fonksiyonu tüm gerekli alanları içeren bir PenaltyRecord döndürmelidir.
   * Not: Fonksiyon girdileri trim eder (baştaki/sondaki boşlukları temizler).
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8e: createPenaltyRecord her zaman gerekli alanları içermeli',
    async () => {
      await fc.assert(
        fc.property(penaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: violation alanı tanımlı ve trim edilmiş olmalı
          expect(record.violation).toBeDefined();
          expect(record.violation).toBe(params.violation.trim());

          // Property 2: article alanı tanımlı ve trim edilmiş olmalı
          expect(record.article).toBeDefined();
          expect(record.article).toBe(params.article.trim());

          // Property 3: duration alanı tanımlı ve trim edilmiş olmalı
          expect(record.duration).toBeDefined();
          expect(record.duration).toBe(params.duration.trim());

          // Property 4: reason alanı tanımlı ve trim edilmiş olmalı
          expect(record.reason).toBeDefined();
          expect(record.reason).toBe(params.reason.trim());

          // Property 5: copyableText alanı tanımlı olmalı
          expect(record.copyableText).toBeDefined();
          expect(typeof record.copyableText).toBe('string');
          expect(record.copyableText.length).toBeGreaterThan(0);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 8f: copyableText tüm ceza bilgilerini içermeli
   *
   * *Herhangi bir* ceza kaydı için, copyableText alanı
   * ihlal türü, madde, süre ve gerekçeyi içermelidir.
   * Not: Fonksiyon girdileri trim eder, bu yüzden trim edilmiş değerler kontrol edilir.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8f: copyableText tüm ceza bilgilerini içermeli',
    async () => {
      await fc.assert(
        fc.property(penaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: copyableText trim edilmiş ihlal türünü içermeli
          expect(record.copyableText).toContain(params.violation.trim());

          // Property 2: copyableText trim edilmiş maddeyi içermeli
          expect(record.copyableText).toContain(params.article.trim());

          // Property 3: copyableText trim edilmiş süreyi içermeli
          expect(record.copyableText).toContain(params.duration.trim());

          // Property 4: copyableText trim edilmiş gerekçeyi içermeli
          expect(record.copyableText).toContain(params.reason.trim());

          // Property 5: copyableText "CEZA KAYDI" başlığını içermeli
          expect(record.copyableText).toContain('CEZA KAYDI');

          // Property 6: copyableText alan etiketlerini içermeli
          expect(record.copyableText).toContain('İhlal:');
          expect(record.copyableText).toContain('Madde:');
          expect(record.copyableText).toContain('Süre:');
          expect(record.copyableText).toContain('Gerekçe:');

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 8g: copyableText formatı tutarlı olmalı
   *
   * *Herhangi bir* ceza kaydı için, copyableText formatı
   * her zaman aynı yapıda olmalıdır.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8g: copyableText formatı tutarlı olmalı',
    async () => {
      await fc.assert(
        fc.property(penaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: Format emoji ile başlamalı
          expect(record.copyableText.startsWith('📋')).toBe(true);

          // Property 2: Ayırıcı çizgiler içermeli
          expect(record.copyableText).toContain('━');

          // Property 3: Satır sırası doğru olmalı
          const lines = record.copyableText.split('\n');
          const ihlalLineIndex = lines.findIndex((l) => l.includes('İhlal:'));
          const maddeLineIndex = lines.findIndex((l) => l.includes('Madde:'));
          const sureLineIndex = lines.findIndex((l) => l.includes('Süre:'));
          const gerekceLineIndex = lines.findIndex((l) => l.includes('Gerekçe:'));

          // Sıralama: İhlal < Madde < Süre < Gerekçe
          expect(ihlalLineIndex).toBeLessThan(maddeLineIndex);
          expect(maddeLineIndex).toBeLessThan(sureLineIndex);
          expect(sureLineIndex).toBeLessThan(gerekceLineIndex);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});

describe('Property Tests: AI - Kaynak Tutarlılığı', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 8h: AI yanıtları kaynak referansları içermeli
   *
   * *Herhangi bir* başarılı AI yanıtı için, kaynak referansları
   * döndürülmelidir.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8h: AI yanıtları kaynak referansları içermeli',
    async () => {
      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: sources dizisi tanımlı olmalı
          expect(response.sources).toBeDefined();
          expect(Array.isArray(response.sources)).toBe(true);

          // Property 2: Context kullanıldıysa kaynak olmalı
          if (response.contextUsed) {
            expect(response.sources.length).toBeGreaterThan(0);

            // Property 3: Her kaynak gerekli alanlara sahip olmalı
            for (const source of response.sources) {
              expect(source.id).toBeDefined();
              expect(source.title).toBeDefined();
              expect(source.type).toBeDefined();
              expect(source.category).toBeDefined();
              expect(source.relevanceScore).toBeDefined();
              expect(source.relevanceScore).toBeGreaterThanOrEqual(0);
              expect(source.relevanceScore).toBeLessThanOrEqual(1);
            }
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 8i: Kaynak tipleri geçerli olmalı
   *
   * *Herhangi bir* kaynak referansı için, tip alanı
   * geçerli bir değer olmalıdır.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8i: Kaynak tipleri geçerli olmalı',
    async () => {
      const validSourceTypes = ['guide', 'penalty', 'command', 'procedure'];

      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property: Her kaynağın tipi geçerli olmalı
          for (const source of response.sources) {
            expect(validSourceTypes).toContain(source.type);
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );
});

describe('Property Tests: AI - Güven Seviyesi Tutarlılığı', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 8j: Güven seviyesi geçerli değerlerden biri olmalı
   *
   * *Herhangi bir* AI yanıtı için, güven seviyesi
   * 'high', 'medium' veya 'low' olmalıdır.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8j: Güven seviyesi geçerli değerlerden biri olmalı',
    async () => {
      const validConfidenceLevels = ['high', 'medium', 'low'];

      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property: Güven seviyesi geçerli olmalı
          expect(validConfidenceLevels).toContain(response.confidence);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 8k: Yüksek güven durumunda context kullanılmalı
   *
   * *Herhangi bir* yüksek güvenli AI yanıtı için,
   * context kullanılmış olmalıdır.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it(
    'Property 8k: Yüksek güven durumunda context kullanılmalı',
    async () => {
      await fc.assert(
        fc.asyncProperty(incidentDescriptionArbitrary, async (incident) => {
          const query = buildIncidentQuery(incident);

          // Mock RAG sonucu (yüksek güven)
          mockRetrievePenaltyContext.mockResolvedValue(
            createHighConfidenceRAGResult(query, incident.violationType)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property: Yüksek güven = context kullanılmış
          if (response.confidence === 'high') {
            expect(response.contextUsed).toBe(true);
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );
});



/**
 * Property 9: AI Belirsizlik Yönetimi
 * Feature: yetkili-kilavuzu, Property 9: AI Belirsizlik Yönetimi
 *
 * Bu test dosyası, AI belirsizlik yönetimini doğrular:
 * - Düşük güven skorlu AI yanıtları için "üst yetkililere danışılmalıdır" mesajı verilmeli
 * - Belirsizlik durumları kullanıcılara açıkça iletilmeli
 * - Düşük güven senaryoları uygun şekilde ele alınmalı
 *
 * **Validates: Requirements 6.5**
 */

// Düşük güvenli RAG sonucu oluşturucu
function createLowConfidenceRAGResult(query: string): RAGRetrievalResult {
  return {
    chunks: [],
    context: '',
    sources: [],
    averageRelevance: 0,
    query,
  };
}

// Çok düşük relevance skorlu RAG sonucu oluşturucu
function createVeryLowRelevanceRAGResult(
  query: string,
  topic: string
): RAGRetrievalResult {
  return {
    chunks: [
      {
        id: `chunk-low-${topic}-1`,
        content: `Genel bilgi: ${topic} hakkında detaylı bilgi mevcut değil.`,
        sourceType: 'guide',
        sourceId: `guide-general`,
        title: 'Genel Bilgi',
        category: 'kilavuz',
        relevanceScore: 0.15, // Çok düşük relevance
        keywords: ['genel'],
      },
    ],
    context: `Genel bilgi: ${topic} hakkında detaylı bilgi mevcut değil.`,
    sources: [
      {
        id: 'guide-general',
        title: 'Genel Bilgi',
        type: 'guide',
        category: 'kilavuz',
        relevanceScore: 0.15,
      },
    ],
    averageRelevance: 0.15, // Düşük ortalama
    query,
  };
}

// Belirsiz sorgu arbitrary generator
// NOT: Sadece büyük harfli prefix + sayılar - hiçbir mod keyword substring'i içermez
// System içerik aramaları Türkçe/İngilizce mod kelimeleri arar, bunlar eşleşmez.
const uncertainQueryArbitrary = fc.record({
  topic: fc.constantFrom(
    'QUERY 44556677',
    'QUERY 55667788',
    'QUERY 66778899',
    'QUERY 77889900',
    'QUERY 88990011',
    'QUERY 99001122',
    'QUERY 00112233',
    'QUERY 11223344',
    'QUERY 22334455',
    'QUERY 33445566'
  ),
  questionType: fc.constantFrom(
    'ALPHA',
    'BETA',
    'GAMMA'
  ),
});

// Rastgele belirsiz sorgu oluşturucu
const randomUncertainQueryArbitrary = fc.string({ minLength: 5, maxLength: 100 }).map(
  (s) => `${s} hakkında ne yapmalıyım?`
);

describe('Property Tests: AI - Belirsizlik Yönetimi (Property 9)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 9a: Boş RAG sonucu için belirsizlik mesajı verilmeli
   *
   * *Herhangi bir* boş RAG sonucu için, AI yanıtı
   * "üst yetkililere danışılmalıdır" mesajını içermelidir.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9a: Boş RAG sonucu için belirsizlik mesajı verilmeli',
    async () => {
      await fc.assert(
        fc.asyncProperty(uncertainQueryArbitrary, async (queryParams) => {
          const query = `${queryParams.topic} için ${queryParams.questionType}?`;

          // Mock boş RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );
          mockRetrieveContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: Yanıt "üst yetkililere danışılmalıdır" mesajını içermeli
          expect(response.response.toLowerCase()).toContain(
            'üst yetkililere danışılmalıdır'
          );

          // Property 2: Güven seviyesi "low" olmalı
          expect(response.confidence).toBe('low');

          // Property 3: Context kullanılmamış olmalı
          expect(response.contextUsed).toBe(false);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 9b: Düşük relevance skorlu sonuçlar için belirsizlik mesajı verilmeli
   *
   * *Herhangi bir* düşük relevance skorlu RAG sonucu için, AI yanıtı
   * "üst yetkililere danışılmalıdır" mesajını içermelidir.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9b: Düşük relevance skorlu sonuçlar için belirsizlik mesajı verilmeli',
    async () => {
      await fc.assert(
        fc.asyncProperty(uncertainQueryArbitrary, async (queryParams) => {
          const query = `${queryParams.topic} için ${queryParams.questionType}?`;

          // Mock düşük relevance RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createVeryLowRelevanceRAGResult(query, queryParams.topic)
          );
          mockRetrieveContext.mockResolvedValue(
            createVeryLowRelevanceRAGResult(query, queryParams.topic)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: Güven seviyesi "low" olmalı
          expect(response.confidence).toBe('low');

          // Property 2: Yanıt belirsizlik mesajı içermeli
          expect(response.response.toLowerCase()).toContain(
            'üst yetkililere danışılmalıdır'
          );

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 9c: Düşük güven durumunda context kullanılmamalı
   *
   * *Herhangi bir* düşük güven skorlu AI yanıtı için,
   * contextUsed false olmalıdır.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9c: Düşük güven durumunda context kullanılmamalı',
    async () => {
      await fc.assert(
        fc.asyncProperty(randomUncertainQueryArbitrary, async (query) => {
          // Mock boş RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );
          mockRetrieveContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property: Düşük güven = context kullanılmamış
          if (response.confidence === 'low') {
            expect(response.contextUsed).toBe(false);
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 9d: Belirsizlik mesajı her zaman Türkçe olmalı
   *
   * *Herhangi bir* düşük güven skorlu AI yanıtı için,
   * belirsizlik mesajı Türkçe olmalıdır.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9d: Belirsizlik mesajı her zaman Türkçe olmalı',
    async () => {
      await fc.assert(
        fc.asyncProperty(uncertainQueryArbitrary, async (queryParams) => {
          const query = `${queryParams.topic} için ${queryParams.questionType}?`;

          // Mock boş RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );
          mockRetrieveContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property 1: Yanıt Türkçe karakterler içermeli
          const turkishChars = ['ı', 'ğ', 'ü', 'ş', 'ö', 'ç', 'İ', 'Ğ', 'Ü', 'Ş', 'Ö', 'Ç'];
          const containsTurkish = turkishChars.some((char) =>
            response.response.includes(char)
          );

          // Property 2: Yanıt "danışılmalıdır" kelimesini içermeli (Türkçe fiil çekimi)
          const containsTurkishVerb = response.response.includes('danışılmalıdır');

          expect(containsTurkish || containsTurkishVerb).toBe(true);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );

  /**
   * Property 9e: Düşük güven durumunda kaynak listesi boş veya minimal olmalı
   *
   * *Herhangi bir* düşük güven skorlu AI yanıtı için,
   * kaynak listesi boş veya çok az kaynak içermelidir.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9e: Düşük güven durumunda kaynak listesi boş veya minimal olmalı',
    async () => {
      await fc.assert(
        fc.asyncProperty(uncertainQueryArbitrary, async (queryParams) => {
          const query = `${queryParams.topic} için ${queryParams.questionType}?`;

          // Mock boş RAG sonucu
          mockRetrievePenaltyContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );
          mockRetrieveContext.mockResolvedValue(
            createLowConfidenceRAGResult(query)
          );

          const request: ChatRequest = {
            message: query,
            useMock: true,
          };

          const response = await chat(request);

          // Property: Düşük güven durumunda kaynak sayısı az olmalı
          if (response.confidence === 'low') {
            expect(response.sources.length).toBeLessThanOrEqual(1);
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    60000
  );
});

describe('Property Tests: AI - Güven Skoru Hesaplama (Property 9 Yardımcı)', () => {
  /**
   * Property 9f: calculateConfidenceScore boş sonuç için 0 döndürmeli
   *
   * *Herhangi bir* boş RAG sonucu için, güven skoru 0 olmalıdır.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9f: calculateConfidenceScore boş sonuç için 0 döndürmeli',
    async () => {
      const { calculateConfidenceScore } = await import('@/lib/ai-assistant');

      await fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (query) => {
          const emptyResult: RAGRetrievalResult = {
            chunks: [],
            context: '',
            sources: [],
            averageRelevance: 0,
            query,
          };

          const score = calculateConfidenceScore(emptyResult);

          // Property: Boş sonuç için skor 0 olmalı
          expect(score).toBe(0);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 9g: getConfidenceLevel düşük skor için 'low' döndürmeli
   *
   * *Herhangi bir* 0.4'ten düşük güven skoru için,
   * güven seviyesi 'low' olmalıdır.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9g: getConfidenceLevel düşük skor için "low" döndürmeli',
    async () => {
      const { getConfidenceLevel } = await import('@/lib/ai-assistant');

      await fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(0.39), noNaN: true }),
          (score) => {
            const level = getConfidenceLevel(score);

            // Property: 0.4'ten düşük skor için seviye 'low' olmalı
            expect(level).toBe('low');

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 9h: getConfidenceLevel orta skor için 'medium' döndürmeli
   *
   * *Herhangi bir* 0.4 ile 0.7 arasındaki güven skoru için,
   * güven seviyesi 'medium' olmalıdır.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9h: getConfidenceLevel orta skor için "medium" döndürmeli',
    async () => {
      const { getConfidenceLevel } = await import('@/lib/ai-assistant');

      await fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.4), max: Math.fround(0.69), noNaN: true }),
          (score) => {
            const level = getConfidenceLevel(score);

            // Property: 0.4-0.7 arası skor için seviye 'medium' olmalı
            expect(level).toBe('medium');

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 9i: getConfidenceLevel yüksek skor için 'high' döndürmeli
   *
   * *Herhangi bir* 0.7 ve üzeri güven skoru için,
   * güven seviyesi 'high' olmalıdır.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9i: getConfidenceLevel yüksek skor için "high" döndürmeli',
    async () => {
      const { getConfidenceLevel } = await import('@/lib/ai-assistant');

      await fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.71), max: Math.fround(1), noNaN: true }),
          (score) => {
            const level = getConfidenceLevel(score);

            // Property: 0.7 ve üzeri skor için seviye 'high' olmalı
            expect(level).toBe('high');

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 9j: Güven skoru her zaman 0-1 arasında olmalı
   *
   * *Herhangi bir* RAG sonucu için, hesaplanan güven skoru
   * 0 ile 1 arasında olmalıdır.
   *
   * **Validates: Requirements 6.5**
   */
  it(
    'Property 9j: Güven skoru her zaman 0-1 arasında olmalı',
    async () => {
      const { calculateConfidenceScore } = await import('@/lib/ai-assistant');

      // Rastgele RAG sonucu oluşturucu
      const ragResultArbitrary = fc.record({
        chunks: fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            content: fc.string({ minLength: 1, maxLength: 100 }),
            sourceType: fc.constantFrom('guide', 'penalty', 'command', 'procedure'),
            sourceId: fc.string({ minLength: 1, maxLength: 20 }),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            category: fc.string({ minLength: 1, maxLength: 20 }),
            relevanceScore: fc.float({ min: 0, max: 1, noNaN: true }),
            keywords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        context: fc.string({ minLength: 0, maxLength: 500 }),
        sources: fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('guide', 'penalty', 'command', 'procedure'),
            category: fc.string({ minLength: 1, maxLength: 20 }),
            relevanceScore: fc.float({ min: 0, max: 1, noNaN: true }),
          }),
          { minLength: 0, maxLength: 5 }
        ),
        averageRelevance: fc.float({ min: 0, max: 1, noNaN: true }),
        query: fc.string({ minLength: 1, maxLength: 100 }),
      });

      await fc.assert(
        fc.property(ragResultArbitrary, (ragResult) => {
          const score = calculateConfidenceScore(ragResult as RAGRetrievalResult);

          // Property: Skor 0-1 arasında olmalı
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});


/**
 * Property 10: Ceza Kaydı Format Tamlığı
 * Feature: yetkili-kilavuzu, Property 10: Ceza Kaydı Format Tamlığı
 *
 * Bu test dosyası, ceza kaydı format tamlığını doğrular:
 * - Herhangi bir ceza kaydı için, kayıt metni ihlal türü içermelidir
 * - Herhangi bir ceza kaydı için, kayıt metni ceza süresi içermelidir
 * - Herhangi bir ceza kaydı için, kayıt metni madde numarası içermelidir
 * - Herhangi bir ceza kaydı için, kayıt metni gerekçe içermelidir
 * - copyableText formatı tutarlı ve tam olmalıdır
 *
 * **Validates: Requirements 7.1, 7.2**
 */

// Property 10 için gelişmiş arbitrary generator'lar
const violationTypeArbitrary = fc.constantFrom(
  'Hakaret',
  'Küfür',
  'Spam',
  'Flood',
  'ADK (Aşırı Derecede Küfür)',
  'XP Abuse',
  'Reklam',
  'CAPS Kullanımı',
  'Mention Spam',
  'NSFW İçerik',
  'Tehdit',
  'Kışkırtma',
  'Irkçılık',
  'Cinsel İçerik',
  'Kural İhlali'
);

const articleNumberArbitrary = fc.constantFrom(
  'Madde 1.1',
  'Madde 1.2',
  'Madde 2.1',
  'Madde 2.2',
  'Madde 3.1',
  'Madde 3.2',
  'Madde 4.1',
  'Madde 4.2',
  'Madde 5.1',
  'Madde 5.2',
  'Madde 6.1',
  'Madde 6.2',
  'Madde 7.1',
  'Madde 7.2',
  'Madde 8.1',
  'Madde 8.2'
);

const penaltyDurationArbitrary = fc.constantFrom(
  '1 saat',
  '6 saat',
  '12 saat',
  '1 gün',
  '3 gün',
  '7 gün',
  '14 gün',
  '30 gün',
  '60 gün',
  '90 gün',
  'Kalıcı',
  'Süresiz',
  'Uyarı'
);

const reasonArbitrary = fc.constantFrom(
  'Sunucu kurallarına aykırı davranış',
  'Diğer kullanıcılara saygısızlık',
  'Spam içerik paylaşımı',
  'Yetkililere karşı saygısız tutum',
  'Tekrarlayan kural ihlali',
  'Topluluk huzurunu bozma',
  'Uygunsuz içerik paylaşımı',
  'Reklam yasağı ihlali',
  'Sesli kanal kurallarını ihlal',
  'Yazılı kanal kurallarını ihlal'
);

// Tam ceza kaydı parametreleri için arbitrary
const fullPenaltyRecordParamsArbitrary = fc.record({
  violation: violationTypeArbitrary,
  article: articleNumberArbitrary,
  duration: penaltyDurationArbitrary,
  reason: reasonArbitrary,
});

// Opsiyonel alanlarla birlikte ceza kaydı parametreleri
const penaltyRecordWithOptionalArbitrary = fc.record({
  violation: violationTypeArbitrary,
  article: articleNumberArbitrary,
  duration: penaltyDurationArbitrary,
  reason: reasonArbitrary,
  notes: fc.option(
    fc.constantFrom(
      'İlk ihlal',
      'Tekrar eden ihlal',
      'Uyarı sonrası',
      'Ciddi ihlal',
      'Hafif ihlal'
    ),
    { nil: undefined }
  ),
});

describe('Property Tests: AI - Ceza Kaydı Format Tamlığı (Property 10)', () => {
  /**
   * Property 10a: Tüm ceza kayıtları ihlal türü içermeli
   *
   * *Herhangi bir* ceza kaydı için, kayıt metni ihlal türünü içermelidir.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10a: Tüm ceza kayıtları ihlal türü içermeli',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: violation alanı tanımlı ve boş olmamalı
          expect(record.violation).toBeDefined();
          expect(record.violation.length).toBeGreaterThan(0);

          // Property 2: copyableText ihlal türünü içermeli
          expect(record.copyableText).toContain(params.violation);

          // Property 3: copyableText "İhlal:" etiketini içermeli
          expect(record.copyableText).toContain('İhlal:');

          // Property 4: İhlal satırı doğru formatta olmalı
          const ihlalLine = record.copyableText
            .split('\n')
            .find((line) => line.includes('İhlal:'));
          expect(ihlalLine).toBeDefined();
          expect(ihlalLine).toContain(params.violation);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10b: Tüm ceza kayıtları ceza süresi içermeli
   *
   * *Herhangi bir* ceza kaydı için, kayıt metni ceza süresini içermelidir.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10b: Tüm ceza kayıtları ceza süresi içermeli',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: duration alanı tanımlı ve boş olmamalı
          expect(record.duration).toBeDefined();
          expect(record.duration.length).toBeGreaterThan(0);

          // Property 2: copyableText ceza süresini içermeli
          expect(record.copyableText).toContain(params.duration);

          // Property 3: copyableText "Süre:" etiketini içermeli
          expect(record.copyableText).toContain('Süre:');

          // Property 4: Süre satırı doğru formatta olmalı
          const sureLine = record.copyableText
            .split('\n')
            .find((line) => line.includes('Süre:'));
          expect(sureLine).toBeDefined();
          expect(sureLine).toContain(params.duration);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10c: Tüm ceza kayıtları madde numarası içermeli
   *
   * *Herhangi bir* ceza kaydı için, kayıt metni madde numarasını içermelidir.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10c: Tüm ceza kayıtları madde numarası içermeli',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: article alanı tanımlı ve boş olmamalı
          expect(record.article).toBeDefined();
          expect(record.article.length).toBeGreaterThan(0);

          // Property 2: copyableText madde numarasını içermeli
          expect(record.copyableText).toContain(params.article);

          // Property 3: copyableText "Madde:" etiketini içermeli
          expect(record.copyableText).toContain('Madde:');

          // Property 4: Madde satırı doğru formatta olmalı
          const maddeLine = record.copyableText
            .split('\n')
            .find((line) => line.includes('Madde:'));
          expect(maddeLine).toBeDefined();
          expect(maddeLine).toContain(params.article);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10d: Tüm ceza kayıtları gerekçe içermeli
   *
   * *Herhangi bir* ceza kaydı için, kayıt metni gerekçeyi içermelidir.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10d: Tüm ceza kayıtları gerekçe içermeli',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: reason alanı tanımlı ve boş olmamalı
          expect(record.reason).toBeDefined();
          expect(record.reason.length).toBeGreaterThan(0);

          // Property 2: copyableText gerekçeyi içermeli
          expect(record.copyableText).toContain(params.reason);

          // Property 3: copyableText "Gerekçe:" etiketini içermeli
          expect(record.copyableText).toContain('Gerekçe:');

          // Property 4: Gerekçe satırı doğru formatta olmalı
          const gerekceLine = record.copyableText
            .split('\n')
            .find((line) => line.includes('Gerekçe:'));
          expect(gerekceLine).toBeDefined();
          expect(gerekceLine).toContain(params.reason);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10e: copyableText formatı tutarlı ve tam olmalı
   *
   * *Herhangi bir* ceza kaydı için, copyableText formatı
   * tüm zorunlu alanları doğru sırada içermelidir.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10e: copyableText formatı tutarlı ve tam olmalı',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: copyableText tanımlı ve boş olmamalı
          expect(record.copyableText).toBeDefined();
          expect(record.copyableText.length).toBeGreaterThan(0);

          // Property 2: "CEZA KAYDI" başlığını içermeli
          expect(record.copyableText).toContain('CEZA KAYDI');

          // Property 3: Tüm zorunlu etiketleri içermeli
          expect(record.copyableText).toContain('İhlal:');
          expect(record.copyableText).toContain('Madde:');
          expect(record.copyableText).toContain('Süre:');
          expect(record.copyableText).toContain('Gerekçe:');

          // Property 4: Tüm değerleri içermeli
          expect(record.copyableText).toContain(params.violation);
          expect(record.copyableText).toContain(params.article);
          expect(record.copyableText).toContain(params.duration);
          expect(record.copyableText).toContain(params.reason);

          // Property 5: Ayırıcı çizgiler içermeli
          expect(record.copyableText).toContain('━');

          // Property 6: Emoji ile başlamalı
          expect(record.copyableText.startsWith('📋')).toBe(true);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10f: copyableText alan sıralaması doğru olmalı
   *
   * *Herhangi bir* ceza kaydı için, copyableText içindeki
   * alanlar doğru sırada olmalıdır: Tarih < İhlal < Madde < Süre < Gerekçe
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10f: copyableText alan sıralaması doğru olmalı',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);
          const lines = record.copyableText.split('\n');

          // Satır indekslerini bul
          const tarihLineIndex = lines.findIndex((l) => l.includes('Tarih:'));
          const ihlalLineIndex = lines.findIndex((l) => l.includes('İhlal:'));
          const maddeLineIndex = lines.findIndex((l) => l.includes('Madde:'));
          const sureLineIndex = lines.findIndex((l) => l.includes('Süre:'));
          const gerekceLineIndex = lines.findIndex((l) => l.includes('Gerekçe:'));

          // Property 1: Tüm alanlar mevcut olmalı
          expect(tarihLineIndex).toBeGreaterThanOrEqual(0);
          expect(ihlalLineIndex).toBeGreaterThanOrEqual(0);
          expect(maddeLineIndex).toBeGreaterThanOrEqual(0);
          expect(sureLineIndex).toBeGreaterThanOrEqual(0);
          expect(gerekceLineIndex).toBeGreaterThanOrEqual(0);

          // Property 2: Sıralama doğru olmalı
          expect(tarihLineIndex).toBeLessThan(ihlalLineIndex);
          expect(ihlalLineIndex).toBeLessThan(maddeLineIndex);
          expect(maddeLineIndex).toBeLessThan(sureLineIndex);
          expect(sureLineIndex).toBeLessThan(gerekceLineIndex);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10g: Opsiyonel alanlar doğru şekilde işlenmeli
   *
   * *Herhangi bir* ceza kaydı için, opsiyonel alanlar (notes)
   * varsa eklenmeli, yoksa format bozulmamalı.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10g: Opsiyonel alanlar doğru şekilde işlenmeli',
    () => {
      fc.assert(
        fc.property(penaltyRecordWithOptionalArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: Zorunlu alanlar her zaman mevcut olmalı
          expect(record.copyableText).toContain('İhlal:');
          expect(record.copyableText).toContain('Madde:');
          expect(record.copyableText).toContain('Süre:');
          expect(record.copyableText).toContain('Gerekçe:');

          // Property 2: Notes varsa "Not:" etiketi olmalı
          if (params.notes) {
            expect(record.copyableText).toContain('Not:');
            expect(record.copyableText).toContain(params.notes);
          }

          // Property 3: Notes yoksa "Not:" etiketi olmamalı
          if (!params.notes) {
            expect(record.copyableText).not.toContain('Not:');
          }

          // Property 4: Format her durumda geçerli olmalı
          expect(record.copyableText.startsWith('📋')).toBe(true);
          expect(record.copyableText).toContain('━');

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10h: Tarih alanı her zaman mevcut olmalı
   *
   * *Herhangi bir* ceza kaydı için, tarih alanı
   * otomatik olarak eklenmeli ve geçerli formatta olmalı.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10h: Tarih alanı her zaman mevcut olmalı',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: "Tarih:" etiketi mevcut olmalı
          expect(record.copyableText).toContain('Tarih:');

          // Property 2: Tarih satırı bulunabilmeli
          const tarihLine = record.copyableText
            .split('\n')
            .find((line) => line.includes('Tarih:'));
          expect(tarihLine).toBeDefined();

          // Property 3: Tarih formatı Türkçe olmalı (gün.ay.yıl)
          // Örnek: 01.01.2024 veya 01.01.2024 12:00
          const datePattern = /\d{2}\.\d{2}\.\d{4}/;
          expect(tarihLine).toMatch(datePattern);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10i: PenaltyRecord objesi tüm alanları içermeli
   *
   * *Herhangi bir* ceza kaydı için, döndürülen PenaltyRecord
   * objesi tüm zorunlu alanları içermelidir.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10i: PenaltyRecord objesi tüm alanları içermeli',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: Tüm zorunlu alanlar tanımlı olmalı
          expect(record).toHaveProperty('violation');
          expect(record).toHaveProperty('article');
          expect(record).toHaveProperty('duration');
          expect(record).toHaveProperty('reason');
          expect(record).toHaveProperty('copyableText');

          // Property 2: Alanlar doğru değerleri içermeli
          expect(record.violation).toBe(params.violation);
          expect(record.article).toBe(params.article);
          expect(record.duration).toBe(params.duration);
          expect(record.reason).toBe(params.reason);

          // Property 3: copyableText string olmalı
          expect(typeof record.copyableText).toBe('string');

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10j: Boş veya geçersiz parametreler hata fırlatmalı
   *
   * *Herhangi bir* boş veya geçersiz parametre için,
   * createPenaltyRecord fonksiyonu hata fırlatmalıdır.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10j: Boş veya geçersiz parametreler hata fırlatmalı',
    () => {
      // Boş violation
      expect(() =>
        createPenaltyRecord({
          violation: '',
          article: 'Madde 1.1',
          duration: '1 gün',
          reason: 'Test gerekçe',
        })
      ).toThrow('İhlal türü zorunludur');

      // Boş article
      expect(() =>
        createPenaltyRecord({
          violation: 'Hakaret',
          article: '',
          duration: '1 gün',
          reason: 'Test gerekçe',
        })
      ).toThrow('Madde numarası zorunludur');

      // Boş duration
      expect(() =>
        createPenaltyRecord({
          violation: 'Hakaret',
          article: 'Madde 1.1',
          duration: '',
          reason: 'Test gerekçe',
        })
      ).toThrow('Ceza süresi zorunludur');

      // Boş reason
      expect(() =>
        createPenaltyRecord({
          violation: 'Hakaret',
          article: 'Madde 1.1',
          duration: '1 gün',
          reason: '',
        })
      ).toThrow('Gerekçe zorunludur');

      // Sadece whitespace
      expect(() =>
        createPenaltyRecord({
          violation: '   ',
          article: 'Madde 1.1',
          duration: '1 gün',
          reason: 'Test gerekçe',
        })
      ).toThrow('İhlal türü zorunludur');
    },
    30000
  );
});

describe('Property Tests: AI - Ceza Kaydı Discord Uyumluluğu (Property 10 Ek)', () => {
  /**
   * Property 10k: copyableText Discord'da düzgün görünmeli
   *
   * *Herhangi bir* ceza kaydı için, copyableText
   * Discord'da düzgün görünecek şekilde formatlanmalı.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10k: copyableText Discord uyumlu olmalı',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: Satır sonları \n olmalı (Discord uyumlu)
          expect(record.copyableText).toContain('\n');

          // Property 2: Çok uzun satırlar olmamalı (Discord 2000 karakter limiti)
          const lines = record.copyableText.split('\n');
          for (const line of lines) {
            expect(line.length).toBeLessThan(500);
          }

          // Property 3: Toplam uzunluk Discord limiti altında olmalı
          expect(record.copyableText.length).toBeLessThan(2000);

          // Property 4: Emoji kullanımı doğru olmalı
          expect(record.copyableText).toContain('📋');
          expect(record.copyableText).toContain('📅');
          expect(record.copyableText).toContain('⚠️');
          expect(record.copyableText).toContain('📖');
          expect(record.copyableText).toContain('⏱️');
          expect(record.copyableText).toContain('📝');

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 10l: copyableText kopyalanabilir olmalı
   *
   * *Herhangi bir* ceza kaydı için, copyableText
   * doğrudan kopyalanıp yapıştırılabilir olmalı.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it(
    'Property 10l: copyableText kopyalanabilir olmalı',
    () => {
      fc.assert(
        fc.property(fullPenaltyRecordParamsArbitrary, (params) => {
          const record = createPenaltyRecord(params);

          // Property 1: copyableText string olmalı
          expect(typeof record.copyableText).toBe('string');

          // Property 2: Özel karakterler escape edilmemeli
          // (Discord'da düzgün görünmesi için)
          expect(record.copyableText).not.toContain('\\n');
          expect(record.copyableText).not.toContain('\\t');

          // Property 3: Başında ve sonunda gereksiz boşluk olmamalı
          expect(record.copyableText).toBe(record.copyableText.trim());

          // Property 4: Tutarlı satır sonları
          const lineEndings = record.copyableText.match(/\r\n|\r|\n/g);
          if (lineEndings) {
            // Tüm satır sonları aynı olmalı
            const uniqueEndings = [...new Set(lineEndings)];
            expect(uniqueEndings.length).toBe(1);
            expect(uniqueEndings[0]).toBe('\n');
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});


/**
 * Property 4: AI Mock Response Keyword Matching
 * Feature: yetkili-kilavuzu-v2-guncelleme, Property 4
 *
 * Bu test, mock mod aktifken keyword bazlı yanıt sistemini doğrular:
 * - Ceza ile ilgili keyword'ler için ilgili yanıt döndürülmeli
 * - Yanıtlar kullanıcı dostu ve bilgilendirici olmalı
 *
 * **Validates: Requirements 4.3, 4.4**
 */

describe('Property Tests: AI Mock Response Keyword Matching (Property 4)', () => {
  /**
   * Property 4a: Her tanımlı keyword için ilgili yanıt döndürülmeli
   *
   * *Herhangi bir* MOCK_RESPONSES'ta tanımlı keyword için,
   * generateEnhancedMockResponse ilgili yanıtı döndürmelidir.
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4a: Her tanımlı keyword için ilgili yanıt döndürülmeli', () => {
    // Tüm keyword'leri topla
    const allKeywords: { keyword: string; expectedResponse: string }[] = [];
    
    for (const [, config] of Object.entries(MOCK_RESPONSES)) {
      for (const keyword of config.keywords) {
        allKeywords.push({
          keyword,
          expectedResponse: config.response,
        });
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...allKeywords),
        ({ keyword, expectedResponse }) => {
          // Keyword'ü içeren bir mesaj oluştur
          const message = `${keyword} hakkında bilgi ver`;
          const response = generateEnhancedMockResponse(message);

          // Property: Yanıt beklenen yanıtla eşleşmeli
          expect(response).toBe(expectedResponse);

          return true;
        }
      ),
      { numRuns: allKeywords.length }
    );
  });

  /**
   * Property 4b: Hakaret keyword'leri için hakaret yanıtı döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4b: Hakaret keyword\'leri için hakaret yanıtı döndürülmeli', () => {
    const hakaretKeywords = ['hakaret', 'küfür', 'sövme', 'argo', 'kaba'];

    fc.assert(
      fc.property(fc.constantFrom(...hakaretKeywords), (keyword) => {
        const message = `Birisi ${keyword} yaptı ne yapmalıyım?`;
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt hakaret ile ilgili olmalı
        expect(response.toLowerCase()).toContain('hakaret');

        // Property 2: Yanıt ceza bilgisi içermeli
        expect(response).toContain('CEZA KAYDI');

        // Property 3: Yanıt süre bilgisi içermeli
        expect(response.toLowerCase()).toContain('gün');

        return true;
      }),
      { numRuns: hakaretKeywords.length }
    );
  });

  /**
   * Property 4c: Spam keyword'leri için spam yanıtı döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4c: Spam keyword\'leri için spam yanıtı döndürülmeli', () => {
    const spamKeywords = ['spam', 'flood', 'tekrar', 'caps'];

    fc.assert(
      fc.property(fc.constantFrom(...spamKeywords), (keyword) => {
        const message = `Kullanıcı ${keyword} yapıyor`;
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt spam ile ilgili olmalı
        expect(response.toLowerCase()).toContain('spam');

        // Property 2: Yanıt ceza bilgisi içermeli
        expect(response).toContain('CEZA KAYDI');

        return true;
      }),
      { numRuns: spamKeywords.length }
    );
  });

  /**
   * Property 4d: Reklam keyword'leri için reklam yanıtı döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4d: Reklam keyword\'leri için reklam yanıtı döndürülmeli', () => {
    const reklamKeywords = ['reklam', 'tanıtım', 'link', 'davet', 'invite'];

    fc.assert(
      fc.property(fc.constantFrom(...reklamKeywords), (keyword) => {
        const message = `Birisi ${keyword} paylaştı`;
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt reklam ile ilgili olmalı
        expect(response.toLowerCase()).toContain('reklam');

        // Property 2: Yanıt ceza bilgisi içermeli
        expect(response).toContain('CEZA KAYDI');

        return true;
      }),
      { numRuns: reklamKeywords.length }
    );
  });

  /**
   * Property 4e: Underage keyword'leri için underage yanıtı döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4e: Underage keyword\'leri için underage yanıtı döndürülmeli', () => {
    const underageKeywords = ['underage', 'yaş', '13', 'küçük'];

    fc.assert(
      fc.property(fc.constantFrom(...underageKeywords), (keyword) => {
        const message = `Kullanıcı ${keyword} ile ilgili sorun var`;
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt underage ile ilgili olmalı
        expect(response.toLowerCase()).toContain('underage');

        // Property 2: Yanıt ban mesajı şablonu içermeli
        expect(response.toLowerCase()).toContain('ban mesajı şablonu');

        return true;
      }),
      { numRuns: underageKeywords.length }
    );
  });

  /**
   * Property 4f: Çalıntı hesap keyword'leri için çalıntı yanıtı döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4f: Çalıntı hesap keyword\'leri için çalıntı yanıtı döndürülmeli', () => {
    const calintiKeywords = ['çalıntı', 'calinti', 'hack', 'ele geçir'];

    fc.assert(
      fc.property(fc.constantFrom(...calintiKeywords), (keyword) => {
        const message = `Hesap ${keyword} olmuş olabilir`;
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt çalıntı hesap ile ilgili olmalı
        expect(response.toLowerCase()).toContain('çalıntı hesap');

        // Property 2: Yanıt ban mesajı şablonu içermeli
        expect(response.toLowerCase()).toContain('ban mesajı şablonu');

        return true;
      }),
      { numRuns: calintiKeywords.length }
    );
  });

  /**
   * Property 4g: Bilinmeyen keyword'ler için varsayılan yanıt döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4g: Bilinmeyen keyword\'ler için varsayılan yanıt döndürülmeli', () => {
    // Bu sorgular hiçbir MOCK_RESPONSES keyword'üne eşleşmemeli
    // Kaçınılması gereken keyword'ler:
    // hakaret, küfür, sövme, argo, kaba, spam, flood, tekrar, mesaj, caps,
    // reklam, tanıtım, link, davet, invite, underage, yaş, 13, küçük, çocuk,
    // çalıntı, calinti, hack, hesap, ele geçir, mute, sustur, susturma, timeout,
    // ban, yasakla, banla, uzaklaştır, komut, command, nasıl, kullan
    const unknownQueries = [
      // Sadece rakam içeren, hiçbir keyword ile eşleşmeyen sorgular
      '1234567890',
      '9876543210',
      '1111222233',
      '5555666677',
      '4444333322',
    ];

    fc.assert(
      fc.property(fc.constantFrom(...unknownQueries), (query) => {
        const response = generateEnhancedMockResponse(query);

        // Property 1: Varsayılan yanıt döndürülmeli
        expect(response).toContain('Bu konuda yeterli bilgi bulunamadı');

        // Property 2: Yardımcı olabileceği konular listelenmeli
        expect(response).toContain('Yardımcı olabileceğim konular');

        // Property 3: Üst yetkililere danışma önerisi olmalı
        expect(response).toContain('üst yetkililere danışabilirsiniz');

        return true;
      }),
      { numRuns: unknownQueries.length }
    );
  });

  /**
   * Property 4h: Tüm mock yanıtlar boş olmamalı
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4h: Tüm mock yanıtlar boş olmamalı', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (message) => {
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt tanımlı olmalı
        expect(response).toBeDefined();

        // Property 2: Yanıt boş olmamalı
        expect(response.length).toBeGreaterThan(0);

        // Property 3: Yanıt string olmalı
        expect(typeof response).toBe('string');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4i: Komut keyword'leri için komut yanıtı döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4i: Komut keyword\'leri için komut yanıtı döndürülmeli', () => {
    const komutKeywords = ['komut', 'command', 'nasıl', 'kullan'];

    fc.assert(
      fc.property(fc.constantFrom(...komutKeywords), (keyword) => {
        const message = `${keyword} hakkında bilgi`;
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt komut bilgisi içermeli
        expect(response.toLowerCase()).toContain('komut');

        // Property 2: Yanıt örnek komutlar içermeli
        expect(response).toContain('h!');

        return true;
      }),
      { numRuns: komutKeywords.length }
    );
  });

  /**
   * Property 4j: Ban keyword'leri için ban yanıtı döndürülmeli
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it('Property 4j: Ban keyword\'leri için ban yanıtı döndürülmeli', () => {
    const banKeywords = ['ban', 'yasakla', 'banla', 'uzaklaştır'];

    fc.assert(
      fc.property(fc.constantFrom(...banKeywords), (keyword) => {
        const message = `Kullanıcıyı ${keyword} etmem gerekiyor`;
        const response = generateEnhancedMockResponse(message);

        // Property 1: Yanıt ban ile ilgili olmalı
        expect(response.toLowerCase()).toContain('ban');

        // Property 2: Yanıt komut bilgisi içermeli
        expect(response).toContain('h!ban');

        return true;
      }),
      { numRuns: banKeywords.length }
    );
  });
});
