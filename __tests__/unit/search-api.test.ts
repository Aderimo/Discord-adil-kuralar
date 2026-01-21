/**
 * Search API Unit Testleri
 * Requirements: 5.1, 5.2, 5.3
 * 
 * Bu testler Search API'nin kullandığı fonksiyonları ve mantığı test eder.
 * API route'u doğrudan test etmek yerine, arama mantığını test ediyoruz.
 */

import {
  searchContent,
  searchByCommonTerm,
  clearContentCache,
} from '@/lib/content';
import type { SearchResult, SearchResultType } from '@/types/content';

/**
 * İçerik tipine göre href oluşturur (API route'taki fonksiyonun kopyası)
 */
function generateHref(result: SearchResult): string {
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
      return `/${result.type}/${result.id}`;
  }
}

/**
 * Content type'ı SearchResultType'a dönüştürür (API route'taki fonksiyonun kopyası)
 */
function normalizeContentType(type: string): SearchResultType | null {
  const typeMap: Record<string, SearchResultType> = {
    guide: 'madde',
    madde: 'madde',
    penalty: 'ceza',
    ceza: 'ceza',
    command: 'komut',
    komut: 'komut',
    procedure: 'prosedur',
    prosedur: 'prosedur',
  };
  
  return typeMap[type.toLowerCase()] || null;
}

/**
 * Arama sonuçlarına href ekler ve filtreler (API route mantığı)
 */
function processSearchResults(
  query: string,
  typeFilter?: string
): { results: (SearchResult & { href: string })[]; query: string } {
  if (!query || query.trim().length === 0) {
    return { results: [], query: '' };
  }

  const trimmedQuery = query.trim();

  // Önce yaygın terimlerle ara, sonra genel arama yap
  let results = searchByCommonTerm(trimmedQuery);
  
  if (results.length === 0) {
    results = searchContent(trimmedQuery);
  }

  // Tip filtresi uygula
  if (typeFilter) {
    const normalizedType = normalizeContentType(typeFilter);
    if (normalizedType) {
      results = results.filter((r) => r.type === normalizedType);
    }
  }

  // Href ekle
  const resultsWithHref = results.map((result) => ({
    ...result,
    href: generateHref(result),
  }));

  return { results: resultsWithHref, query: trimmedQuery };
}

describe('Search API Logic', () => {
  beforeEach(() => {
    clearContentCache();
  });

  describe('Temel Arama İşlevselliği', () => {
    it('boş sorgu için boş sonuç döndürmeli', () => {
      const { results } = processSearchResults('');
      expect(results).toEqual([]);
    });

    it('geçerli sorgu için sonuç döndürmeli', () => {
      const { results, query } = processSearchResults('hakaret');
      expect(results.length).toBeGreaterThan(0);
      expect(query).toBe('hakaret');
    });

    it('sonuçlar href içermeli', () => {
      const { results } = processSearchResults('mute');
      
      if (results.length > 0) {
        results.forEach((result) => {
          expect(result).toHaveProperty('href');
          expect(typeof result.href).toBe('string');
          expect(result.href.startsWith('/')).toBe(true);
        });
      }
    });

    it('sonuçlar doğru yapıda olmalı', () => {
      const { results } = processSearchResults('ceza');
      
      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('excerpt');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('relevanceScore');
        expect(result).toHaveProperty('href');
      }
    });

    it('sonuçlar ilgililik skoruna göre sıralı olmalı', () => {
      const { results } = processSearchResults('ceza');
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.relevanceScore).toBeLessThanOrEqual(
          results[i - 1]!.relevanceScore
        );
      }
    });
  });

  describe('Tip Filtreleme', () => {
    it('ceza tipi filtresi çalışmalı', () => {
      const { results } = processSearchResults('hakaret', 'ceza');
      
      results.forEach((result) => {
        expect(result.type).toBe('ceza');
      });
    });

    it('penalty tipi ceza olarak dönüştürülmeli', () => {
      const { results } = processSearchResults('hakaret', 'penalty');
      
      results.forEach((result) => {
        expect(result.type).toBe('ceza');
      });
    });

    it('komut tipi filtresi çalışmalı', () => {
      const { results } = processSearchResults('mute', 'komut');
      
      results.forEach((result) => {
        expect(result.type).toBe('komut');
      });
    });

    it('command tipi komut olarak dönüştürülmeli', () => {
      const { results } = processSearchResults('mute', 'command');
      
      results.forEach((result) => {
        expect(result.type).toBe('komut');
      });
    });

    it('guide tipi madde olarak dönüştürülmeli', () => {
      const { results } = processSearchResults('yetkili', 'guide');
      
      results.forEach((result) => {
        expect(result.type).toBe('madde');
      });
    });

    it('procedure tipi prosedur olarak dönüştürülmeli', () => {
      const { results } = processSearchResults('ceza', 'procedure');
      
      results.forEach((result) => {
        expect(result.type).toBe('prosedur');
      });
    });
  });

  describe('Yaygın Terimler (Requirement 5.3)', () => {
    it('hakaret terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('hakaret');
      expect(results.length).toBeGreaterThan(0);
    });

    it('xp abuse terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('xp abuse');
      expect(results.length).toBeGreaterThan(0);
    });

    it('adk terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('adk');
      expect(results.length).toBeGreaterThan(0);
    });

    it('noroom terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('noroom');
      expect(results.length).toBeGreaterThan(0);
    });

    it('pls terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('pls');
      expect(results.length).toBeGreaterThan(0);
    });

    it('mute terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('mute');
      expect(results.length).toBeGreaterThan(0);
    });

    it('ban terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('ban');
      expect(results.length).toBeGreaterThan(0);
    });

    it('blacklist terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('blacklist');
      expect(results.length).toBeGreaterThan(0);
    });

    it('küfür terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('küfür');
      expect(results.length).toBeGreaterThan(0);
    });

    it('spam terimi sonuç döndürmeli', () => {
      const { results } = processSearchResults('spam');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Href Oluşturma', () => {
    it('madde tipi için /guide/ href oluşturmalı', () => {
      const { results } = processSearchResults('yetkili', 'guide');

      if (results.length > 0) {
        results.forEach((result) => {
          expect(result.href).toMatch(/^\/guide\//);
        });
      }
    });

    it('ceza tipi için /penalties/ href oluşturmalı', () => {
      const { results } = processSearchResults('hakaret', 'ceza');

      if (results.length > 0) {
        results.forEach((result) => {
          expect(result.href).toMatch(/^\/penalties\//);
        });
      }
    });

    it('komut tipi için /commands/ href oluşturmalı', () => {
      const { results } = processSearchResults('mute', 'komut');

      if (results.length > 0) {
        results.forEach((result) => {
          expect(result.href).toMatch(/^\/commands\//);
        });
      }
    });

    it('prosedur tipi için /procedures/ href oluşturmalı', () => {
      const { results } = processSearchResults('ceza', 'procedure');

      if (results.length > 0) {
        results.forEach((result) => {
          expect(result.href).toMatch(/^\/procedures\//);
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('sadece boşluk içeren sorgu için boş sonuç döndürmeli', () => {
      const { results } = processSearchResults('   ');
      expect(results).toEqual([]);
    });

    it('olmayan terim için boş sonuç döndürmeli', () => {
      const { results } = processSearchResults('xyznonexistentterm123456');
      expect(results).toEqual([]);
    });

    it('geçersiz tip filtresi tüm sonuçları döndürmeli', () => {
      const { results } = processSearchResults('ceza', 'invalidtype');
      // Geçersiz tip filtresi görmezden gelinmeli, tüm sonuçlar dönmeli
      expect(results.length).toBeGreaterThan(0);
    });

    it('sorgu trim edilmeli', () => {
      const { query } = processSearchResults('  hakaret  ');
      expect(query).toBe('hakaret');
    });
  });

  describe('normalizeContentType Fonksiyonu', () => {
    it('guide -> madde dönüşümü yapmalı', () => {
      expect(normalizeContentType('guide')).toBe('madde');
    });

    it('penalty -> ceza dönüşümü yapmalı', () => {
      expect(normalizeContentType('penalty')).toBe('ceza');
    });

    it('command -> komut dönüşümü yapmalı', () => {
      expect(normalizeContentType('command')).toBe('komut');
    });

    it('procedure -> prosedur dönüşümü yapmalı', () => {
      expect(normalizeContentType('procedure')).toBe('prosedur');
    });

    it('büyük/küçük harf duyarsız olmalı', () => {
      expect(normalizeContentType('GUIDE')).toBe('madde');
      expect(normalizeContentType('Penalty')).toBe('ceza');
      expect(normalizeContentType('COMMAND')).toBe('komut');
    });

    it('geçersiz tip için null döndürmeli', () => {
      expect(normalizeContentType('invalid')).toBeNull();
      expect(normalizeContentType('')).toBeNull();
    });
  });

  describe('generateHref Fonksiyonu', () => {
    it('madde tipi için doğru href oluşturmalı', () => {
      const result: SearchResult = {
        id: 'guide-001',
        type: 'madde',
        title: 'Test',
        excerpt: 'Test',
        category: 'kilavuz',
        relevanceScore: 1,
      };
      expect(generateHref(result)).toBe('/guide/guide-001');
    });

    it('ceza tipi için doğru href oluşturmalı', () => {
      const result: SearchResult = {
        id: 'penalty-001',
        type: 'ceza',
        title: 'Test',
        excerpt: 'Test',
        category: 'yazili',
        relevanceScore: 1,
      };
      expect(generateHref(result)).toBe('/penalties/penalty-001');
    });

    it('komut tipi için doğru href oluşturmalı', () => {
      const result: SearchResult = {
        id: 'cmd-001',
        type: 'komut',
        title: 'Test',
        excerpt: 'Test',
        category: 'komut',
        relevanceScore: 1,
      };
      expect(generateHref(result)).toBe('/commands/cmd-001');
    });

    it('prosedur tipi için doğru href oluşturmalı', () => {
      const result: SearchResult = {
        id: 'proc-001',
        type: 'prosedur',
        title: 'Test',
        excerpt: 'Test',
        category: 'prosedur',
        relevanceScore: 1,
      };
      expect(generateHref(result)).toBe('/procedures/proc-001');
    });
  });
});
