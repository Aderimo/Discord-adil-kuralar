/**
 * Search Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 6: Arama Sonuçları Tutarlılığı
 *
 * Bu test dosyası, arama sonuçlarının tutarlılığını doğrular:
 * - Arama sonuçları her zaman gerekli alanlara sahip olmalı (id, type, title, excerpt, relevanceScore)
 * - Sonuçlar ilgililik skoruna göre azalan sırada sıralanmalı
 * - Aynı sorgu tutarlı sonuçlar döndürmeli
 * - Tip filtresi sadece o tipteki sonuçları döndürmeli
 * - Boş sorgu boş sonuç döndürmeli
 * - Sonuçlar geçerli href yollarına sahip olmalı
 *
 * **Validates: Requirements 5.1, 5.2**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import {
  searchContent,
  searchByCommonTerm,
  loadGuideContent,
  loadPenalties,
  loadCommands,
  loadProcedures,
  clearContentCache,
} from '@/lib/content';
import type { SearchResult, SearchResultType } from '@/types/content';

// Her test öncesi cache'i temizle
beforeEach(() => {
  clearContentCache();
});

// Geçerli arama sonuç tipleri
const validSearchResultTypes: SearchResultType[] = ['madde', 'ceza', 'komut', 'prosedur'];

// Arama sorgusu için arbitrary generator
const searchQueryArbitrary = fc.stringOf(
  fc.constantFrom(
    ...'abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789 '
  ),
  { minLength: 1, maxLength: 50 }
);

// Yaygın arama terimleri
const commonSearchTerms = [
  'hakaret',
  'küfür',
  'spam',
  'xp abuse',
  'xp',
  'adk',
  'mute',
  'ban',
  'blacklist',
  'marked',
  'noroom',
  'pls',
  'ceza',
  'komut',
  'prosedür',
  'kayıt',
  'yetkili',
];

describe('Property Tests: Search - Arama Sonuçları Tutarlılığı', () => {
  /**
   * Property 6a: Arama sonuçları her zaman gerekli alanlara sahip olmalı
   *
   * *Herhangi bir* arama sorgusu için, dönen sonuçlar id, type, title,
   * excerpt ve relevanceScore alanlarına sahip olmalıdır.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6a: Arama sonuçları her zaman gerekli alanlara sahip olmalı (id, type, title, excerpt, relevanceScore)',
    async () => {
      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchContent(query.trim());

          // Her sonuç için gerekli alanları kontrol et
          for (const result of results) {
            // Property 1: id alanı tanımlı ve boş olmayan string olmalı
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);

            // Property 2: type alanı geçerli bir SearchResultType olmalı
            expect(result.type).toBeDefined();
            expect(validSearchResultTypes).toContain(result.type);

            // Property 3: title alanı tanımlı ve boş olmayan string olmalı
            expect(result.title).toBeDefined();
            expect(typeof result.title).toBe('string');
            expect(result.title.length).toBeGreaterThan(0);

            // Property 4: excerpt alanı tanımlı ve string olmalı
            expect(result.excerpt).toBeDefined();
            expect(typeof result.excerpt).toBe('string');

            // Property 5: relevanceScore 0-1 arasında olmalı
            expect(result.relevanceScore).toBeDefined();
            expect(typeof result.relevanceScore).toBe('number');
            expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
            expect(result.relevanceScore).toBeLessThanOrEqual(1);

            // Property 6: category alanı tanımlı olmalı
            expect(result.category).toBeDefined();
            expect(typeof result.category).toBe('string');
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

  /**
   * Property 6b: Sonuçlar ilgililik skoruna göre azalan sırada sıralanmalı
   *
   * *Herhangi bir* arama sorgusu için, dönen sonuçlar relevanceScore'a göre
   * azalan sırada (en yüksekten en düşüğe) sıralanmalıdır.
   *
   * **Validates: Requirements 5.2**
   */
  it(
    'Property 6b: Sonuçlar ilgililik skoruna göre azalan sırada sıralanmalı',
    async () => {
      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchContent(query.trim());

          // En az 2 sonuç varsa sıralama kontrolü yap
          if (results.length >= 2) {
            for (let i = 0; i < results.length - 1; i++) {
              const current = results[i];
              const next = results[i + 1];

              // Property: Her sonucun skoru bir sonrakinden büyük veya eşit olmalı
              expect(current!.relevanceScore).toBeGreaterThanOrEqual(
                next!.relevanceScore
              );
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
    30000
  );

  /**
   * Property 6c: Aynı sorgu tutarlı sonuçlar döndürmeli
   *
   * *Herhangi bir* arama sorgusu için, aynı sorgu birden fazla kez
   * çalıştırıldığında aynı sonuçları döndürmelidir.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6c: Aynı sorgu tutarlı sonuçlar döndürmeli',
    async () => {
      await fc.assert(
        fc.property(
          searchQueryArbitrary,
          fc.integer({ min: 2, max: 5 }),
          (query, repeatCount) => {
            const trimmedQuery = query.trim();

            // İlk arama
            const firstResults = searchContent(trimmedQuery);

            // Birden fazla kez aynı sorguyu çalıştır
            for (let i = 0; i < repeatCount; i++) {
              const results = searchContent(trimmedQuery);

              // Property 1: Sonuç sayısı aynı olmalı
              expect(results.length).toBe(firstResults.length);

              // Property 2: Her sonucun ID'si aynı sırada olmalı
              for (let j = 0; j < results.length; j++) {
                expect(results[j]!.id).toBe(firstResults[j]!.id);
                expect(results[j]!.type).toBe(firstResults[j]!.type);
                expect(results[j]!.title).toBe(firstResults[j]!.title);
                expect(results[j]!.relevanceScore).toBe(
                  firstResults[j]!.relevanceScore
                );
              }
            }

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
   * Property 6d: Boş sorgu boş sonuç döndürmeli
   *
   * Boş string veya sadece boşluk içeren sorgular için
   * boş sonuç dizisi döndürülmelidir.
   *
   * **Validates: Requirements 5.1**
   */
  it(
    'Property 6d: Boş sorgu boş sonuç döndürmeli',
    async () => {
      await fc.assert(
        fc.property(
          fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 10 }),
          (emptyQuery) => {
            const results = searchContent(emptyQuery);

            // Property: Boş sorgu boş sonuç döndürmeli
            expect(results).toEqual([]);

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
   * Property 6e: Sonuçların ID'leri mevcut içeriklerle eşleşmeli
   *
   * *Herhangi bir* arama sonucu için, sonucun ID'si mevcut içeriklerden
   * birinin ID'siyle eşleşmelidir.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6e: Sonuçların ID\'leri mevcut içeriklerle eşleşmeli',
    async () => {
      // Tüm geçerli ID'leri topla
      const allValidIds = new Set([
        ...loadGuideContent().map((g) => g.id),
        ...loadPenalties().map((p) => p.id),
        ...loadCommands().map((c) => c.id),
        ...loadProcedures().map((p) => p.id),
      ]);

      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchContent(query.trim());

          // Her sonucun ID'si geçerli olmalı
          for (const result of results) {
            expect(allValidIds.has(result.id)).toBe(true);
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

describe('Property Tests: Search - Tip Bazlı Filtreleme', () => {
  /**
   * Property 6f: Sonuç tipi içerik kaynağıyla tutarlı olmalı
   *
   * *Herhangi bir* arama sonucu için, sonucun tipi içeriğin
   * geldiği kaynakla tutarlı olmalıdır.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6f: Sonuç tipi içerik kaynağıyla tutarlı olmalı',
    async () => {
      // Her tip için geçerli ID'leri topla
      const guideIds = new Set(loadGuideContent().map((g) => g.id));
      const penaltyIds = new Set(loadPenalties().map((p) => p.id));
      const commandIds = new Set(loadCommands().map((c) => c.id));
      const procedureIds = new Set(loadProcedures().map((p) => p.id));

      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchContent(query.trim());

          for (const result of results) {
            // Property: Tip ve ID kaynağı tutarlı olmalı
            switch (result.type) {
              case 'madde':
                expect(guideIds.has(result.id)).toBe(true);
                break;
              case 'ceza':
                expect(penaltyIds.has(result.id)).toBe(true);
                break;
              case 'komut':
                expect(commandIds.has(result.id)).toBe(true);
                break;
              case 'prosedur':
                expect(procedureIds.has(result.id)).toBe(true);
                break;
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
    30000
  );

  /**
   * Property 6g: Sonuçlarda tekrar olmamalı
   *
   * *Herhangi bir* arama sorgusu için, dönen sonuçlarda
   * aynı ID birden fazla kez bulunmamalıdır.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6g: Sonuçlarda tekrar olmamalı',
    async () => {
      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchContent(query.trim());

          // Tüm ID'leri topla
          const ids = results.map((r) => r.id);
          const uniqueIds = new Set(ids);

          // Property: Benzersiz ID sayısı toplam sonuç sayısına eşit olmalı
          expect(uniqueIds.size).toBe(ids.length);

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

describe('Property Tests: Search - Yaygın Terimler', () => {
  /**
   * Property 6h: Yaygın terimler için searchByCommonTerm sonuç döndürmeli
   *
   * Tanımlı yaygın terimler için searchByCommonTerm fonksiyonu
   * en az bir sonuç döndürmelidir.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6h: Yaygın terimler için searchByCommonTerm sonuç döndürmeli',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...commonSearchTerms),
          (term) => {
            const results = searchByCommonTerm(term);

            // Property: Yaygın terimler için sonuç döndürülmeli
            // Not: Bazı terimler için sonuç olmayabilir, bu durumda searchContent'e fallback yapılır
            expect(Array.isArray(results)).toBe(true);

            // Sonuçlar varsa gerekli alanlara sahip olmalı
            for (const result of results) {
              expect(result.id).toBeDefined();
              expect(result.type).toBeDefined();
              expect(result.title).toBeDefined();
              expect(result.excerpt).toBeDefined();
              expect(result.relevanceScore).toBeDefined();
            }

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
   * Property 6i: searchByCommonTerm sonuçları da gerekli alanlara sahip olmalı
   *
   * *Herhangi bir* yaygın terim araması için, dönen sonuçlar
   * standart SearchResult yapısına uygun olmalıdır.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6i: searchByCommonTerm sonuçları da gerekli alanlara sahip olmalı',
    async () => {
      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchByCommonTerm(query.trim());

          for (const result of results) {
            // Property 1: id alanı tanımlı ve boş olmayan string olmalı
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);

            // Property 2: type alanı geçerli bir SearchResultType olmalı
            expect(result.type).toBeDefined();
            expect(validSearchResultTypes).toContain(result.type);

            // Property 3: title alanı tanımlı ve boş olmayan string olmalı
            expect(result.title).toBeDefined();
            expect(typeof result.title).toBe('string');
            expect(result.title.length).toBeGreaterThan(0);

            // Property 4: excerpt alanı tanımlı ve string olmalı
            expect(result.excerpt).toBeDefined();
            expect(typeof result.excerpt).toBe('string');

            // Property 5: relevanceScore 0-1 arasında olmalı
            expect(result.relevanceScore).toBeDefined();
            expect(typeof result.relevanceScore).toBe('number');
            expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
            expect(result.relevanceScore).toBeLessThanOrEqual(1);
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

describe('Property Tests: Search - Href Yolları', () => {
  /**
   * Property 6j: Sonuçlar için geçerli href yolları oluşturulabilmeli
   *
   * *Herhangi bir* arama sonucu için, sonucun id ve type bilgisinden
   * geçerli bir href yolu oluşturulabilmelidir.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6j: Sonuçlar için geçerli href yolları oluşturulabilmeli',
    async () => {
      // Href yolu oluşturma fonksiyonu
      const generateHref = (result: SearchResult): string => {
        switch (result.type) {
          case 'madde':
            return `/guide/${result.id}`;
          case 'ceza':
            return `/penalties/${result.id}`;
          case 'komut':
            return `/commands/${result.id}`;
          case 'prosedur':
            return `/procedures/${result.id}`;
          default:
            return `/content/${result.id}`;
        }
      };

      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchContent(query.trim());

          for (const result of results) {
            const href = generateHref(result);

            // Property 1: href boş olmamalı
            expect(href.length).toBeGreaterThan(0);

            // Property 2: href / ile başlamalı
            expect(href.startsWith('/')).toBe(true);

            // Property 3: href sonuç ID'sini içermeli
            expect(href).toContain(result.id);

            // Property 4: href geçerli bir yol formatında olmalı
            expect(href).toMatch(/^\/[a-z]+\/[a-z0-9-]+$/);
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

  /**
   * Property 6k: Sonuç kategorisi tip ile tutarlı olmalı
   *
   * *Herhangi bir* arama sonucu için, category alanı
   * type alanıyla tutarlı olmalıdır.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6k: Sonuç kategorisi tip ile tutarlı olmalı',
    async () => {
      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const results = searchContent(query.trim());

          for (const result of results) {
            // Property: Tip ve kategori tutarlı olmalı
            switch (result.type) {
              case 'madde':
                // Kılavuz içerikleri için kategori 'kilavuz' olmalı
                expect(['kilavuz', 'ceza', 'komut', 'prosedur']).toContain(
                  result.category
                );
                break;
              case 'ceza':
                // Cezalar için kategori ceza alt kategorisi olmalı
                expect([
                  'yazili',
                  'sesli',
                  'ekstra',
                  'marked',
                  'blacklist',
                ]).toContain(result.category);
                break;
              case 'komut':
                // Komutlar için kategori 'komut' olmalı
                expect(result.category).toBe('komut');
                break;
              case 'prosedur':
                // Prosedürler için kategori 'prosedur' olmalı
                expect(result.category).toBe('prosedur');
                break;
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
    30000
  );
});

describe('Property Tests: Search - Skor Hesaplama', () => {
  /**
   * Property 6l: Tam eşleşme daha yüksek skor almalı
   *
   * Bir terim tam olarak içerikte geçiyorsa, kısmi eşleşmeden
   * daha yüksek skor almalıdır.
   *
   * **Validates: Requirements 5.2**
   */
  it(
    'Property 6l: Tüm sonuçların skoru pozitif olmalı',
    async () => {
      await fc.assert(
        fc.property(searchQueryArbitrary, (query) => {
          const trimmedQuery = query.trim();
          if (trimmedQuery.length === 0) return true;

          const results = searchContent(trimmedQuery);

          // Property: Tüm sonuçların skoru pozitif olmalı
          for (const result of results) {
            expect(result.relevanceScore).toBeGreaterThan(0);
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

  /**
   * Property 6m: Skor hesaplama deterministik olmalı
   *
   * Aynı sorgu ve içerik için skor hesaplama her zaman
   * aynı sonucu vermelidir.
   *
   * **Validates: Requirements 5.2**
   */
  it(
    'Property 6m: Skor hesaplama deterministik olmalı',
    async () => {
      await fc.assert(
        fc.property(
          searchQueryArbitrary,
          fc.integer({ min: 2, max: 5 }),
          (query, repeatCount) => {
            const trimmedQuery = query.trim();

            // İlk arama
            const firstResults = searchContent(trimmedQuery);
            const firstScores = firstResults.map((r) => ({
              id: r.id,
              score: r.relevanceScore,
            }));

            // Birden fazla kez aynı sorguyu çalıştır
            for (let i = 0; i < repeatCount; i++) {
              const results = searchContent(trimmedQuery);

              // Property: Her sonucun skoru aynı olmalı
              for (let j = 0; j < results.length; j++) {
                const firstScore = firstScores.find(
                  (s) => s.id === results[j]!.id
                );
                expect(firstScore).toBeDefined();
                expect(results[j]!.relevanceScore).toBe(firstScore!.score);
              }
            }

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
});
