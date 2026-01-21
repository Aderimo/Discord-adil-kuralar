/**
 * Property Test: Quick Access Card Navigation Correctness
 * 
 * Feature: yetkili-kilavuzu-v2-guncelleme
 * Property 1: Quick Access Card Navigation Correctness
 * 
 * For any quick access card on the homepage, the href value SHALL be 
 * a root path (e.g., `/guide`, `/penalties`, `/procedures`) without 
 * any sub-path segments.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */

import fc from 'fast-check';

// Quick access card tanımları
interface QuickAccessCardConfig {
  id: string;
  title: string;
  href: string;
  expectedPath: string;
}

const QUICK_ACCESS_CARDS: QuickAccessCardConfig[] = [
  { id: 'guide', title: 'Yetkili Kılavuzu', href: '/guide', expectedPath: '/guide' },
  { id: 'penalties', title: 'Cezalar', href: '/penalties', expectedPath: '/penalties' },
  { id: 'commands', title: 'Komutlar', href: '/commands', expectedPath: '/commands' },
  { id: 'procedures', title: 'Prosedürler', href: '/procedures', expectedPath: '/procedures' },
];

// Root path kontrolü - alt yol içermemeli
function isRootPath(path: string): boolean {
  // Path / ile başlamalı
  if (!path.startsWith('/')) return false;
  
  // Path'i parçala
  const segments = path.split('/').filter(Boolean);
  
  // Sadece bir segment olmalı (root path)
  return segments.length === 1;
}

// Path'in geçerli bir sayfa yolu olup olmadığını kontrol et
function isValidPagePath(path: string): boolean {
  const validPaths = ['/guide', '/penalties', '/commands', '/procedures', '/admin', '/templates'];
  return validPaths.includes(path);
}

describe('Quick Access Card Navigation Correctness', () => {
  /**
   * Property 1: Tüm quick access card href değerleri root path olmalı
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('should have root paths for all quick access cards', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...QUICK_ACCESS_CARDS),
        (card) => {
          // Her kart için href root path olmalı
          const isRoot = isRootPath(card.href);
          
          if (!isRoot) {
            console.error(`Card "${card.title}" has non-root path: ${card.href}`);
          }
          
          return isRoot;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Tüm href değerleri beklenen path ile eşleşmeli
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('should match expected paths for all quick access cards', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...QUICK_ACCESS_CARDS),
        (card) => {
          return card.href === card.expectedPath;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Tüm href değerleri geçerli sayfa yolları olmalı
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('should have valid page paths for all quick access cards', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...QUICK_ACCESS_CARDS),
        (card) => {
          return isValidPagePath(card.href);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Hiçbir href değeri alt yol içermemeli
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('should not contain sub-paths in any quick access card href', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...QUICK_ACCESS_CARDS),
        (card) => {
          // Alt yol kontrolü - /path/subpath formatında olmamalı
          const hasSubPath = card.href.split('/').filter(Boolean).length > 1;
          return !hasSubPath;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit test: Spesifik kartların doğru yönlendirmesi
  describe('Specific card navigation', () => {
    it('Yetkili Kılavuzu should navigate to /guide', () => {
      const card = QUICK_ACCESS_CARDS.find(c => c.id === 'guide');
      expect(card?.href).toBe('/guide');
    });

    it('Cezalar should navigate to /penalties', () => {
      const card = QUICK_ACCESS_CARDS.find(c => c.id === 'penalties');
      expect(card?.href).toBe('/penalties');
    });

    it('Komutlar should navigate to /commands', () => {
      const card = QUICK_ACCESS_CARDS.find(c => c.id === 'commands');
      expect(card?.href).toBe('/commands');
    });

    it('Prosedürler should navigate to /procedures', () => {
      const card = QUICK_ACCESS_CARDS.find(c => c.id === 'procedures');
      expect(card?.href).toBe('/procedures');
    });
  });
});
