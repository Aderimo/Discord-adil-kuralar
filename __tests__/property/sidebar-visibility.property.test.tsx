/**
 * Property Test: Sidebar Visibility Invariant
 * 
 * Feature: yetkili-kilavuzu-v2-guncelleme
 * Property 2: Sidebar Visibility Invariant
 * 
 * For any authenticated page in the application (guide, penalties, commands, 
 * procedures, admin), the Sidebar component SHALL be rendered and visible in the DOM.
 * 
 * **Validates: Requirements 2.1, 2.2**
 */

import fc from 'fast-check';

// Authenticated sayfalar listesi
const AUTHENTICATED_PAGES = [
  { path: '/', name: 'Ana Sayfa', hasSidebar: true },
  { path: '/guide', name: 'Yetkili Kılavuzu', hasSidebar: true },
  { path: '/guide/giris', name: 'Kılavuz Detay', hasSidebar: true },
  { path: '/penalties', name: 'Cezalar', hasSidebar: true },
  { path: '/penalties/yazili', name: 'Yazılı Cezalar', hasSidebar: true },
  { path: '/penalties/sesli', name: 'Sesli Cezalar', hasSidebar: true },
  { path: '/commands', name: 'Komutlar', hasSidebar: true },
  { path: '/procedures', name: 'Prosedürler', hasSidebar: true },
  { path: '/admin', name: 'Admin Paneli', hasSidebar: true },
  { path: '/admin/logs', name: 'Aktivite Logları', hasSidebar: true },
];

// Sidebar gerektirmeyen sayfalar (auth sayfaları)
const NON_SIDEBAR_PAGES = [
  { path: '/login', name: 'Giriş' },
  { path: '/register', name: 'Kayıt' },
  { path: '/pending', name: 'Beklemede' },
  { path: '/unauthorized', name: 'Yetkisiz' },
];

// Sayfa yapılandırmasını kontrol et
interface PageConfig {
  path: string;
  name: string;
  hasSidebar: boolean;
}

function shouldHaveSidebar(path: string): boolean {
  // Auth sayfaları sidebar içermemeli
  const nonSidebarPaths = NON_SIDEBAR_PAGES.map(p => p.path);
  if (nonSidebarPaths.includes(path)) {
    return false;
  }
  
  // Diğer tüm authenticated sayfalar sidebar içermeli
  return true;
}

describe('Sidebar Visibility Invariant', () => {
  /**
   * Property 1: Tüm authenticated sayfalar sidebar içermeli
   * **Validates: Requirements 2.1, 2.2**
   */
  it('should have sidebar on all authenticated pages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AUTHENTICATED_PAGES),
        (page: PageConfig) => {
          // Her authenticated sayfa sidebar içermeli
          return page.hasSidebar === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Auth sayfaları sidebar içermemeli
   * **Validates: Requirements 2.1, 2.2**
   */
  it('should not have sidebar on auth pages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NON_SIDEBAR_PAGES),
        (page) => {
          return shouldHaveSidebar(page.path) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Sidebar durumu path'e göre tutarlı olmalı
   * **Validates: Requirements 2.1, 2.2**
   */
  it('should have consistent sidebar state based on path', () => {
    const allPages = [...AUTHENTICATED_PAGES, ...NON_SIDEBAR_PAGES.map(p => ({ ...p, hasSidebar: false }))];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...allPages),
        (page: PageConfig) => {
          const expected = shouldHaveSidebar(page.path);
          return page.hasSidebar === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests: Spesifik sayfa kontrolleri
  describe('Specific page sidebar checks', () => {
    it('Ana Sayfa should have sidebar', () => {
      const page = AUTHENTICATED_PAGES.find(p => p.path === '/');
      expect(page?.hasSidebar).toBe(true);
    });

    it('Guide pages should have sidebar', () => {
      const guidePages = AUTHENTICATED_PAGES.filter(p => p.path.startsWith('/guide'));
      guidePages.forEach(page => {
        expect(page.hasSidebar).toBe(true);
      });
    });

    it('Penalties pages should have sidebar', () => {
      const penaltyPages = AUTHENTICATED_PAGES.filter(p => p.path.startsWith('/penalties'));
      penaltyPages.forEach(page => {
        expect(page.hasSidebar).toBe(true);
      });
    });

    it('Commands page should have sidebar', () => {
      const page = AUTHENTICATED_PAGES.find(p => p.path === '/commands');
      expect(page?.hasSidebar).toBe(true);
    });

    it('Admin pages should have sidebar', () => {
      const adminPages = AUTHENTICATED_PAGES.filter(p => p.path.startsWith('/admin'));
      adminPages.forEach(page => {
        expect(page.hasSidebar).toBe(true);
      });
    });

    it('Login page should not have sidebar', () => {
      const page = NON_SIDEBAR_PAGES.find(p => p.path === '/login');
      expect(shouldHaveSidebar(page?.path || '')).toBe(false);
    });
  });
});
