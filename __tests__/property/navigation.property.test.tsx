/**
 * Navigation Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 13: Navigasyon Tutarlılığı
 *
 * Bu test dosyası, navigasyon tutarlılığını doğrular:
 * - Geri butonu her zaman görünür olmalı
 * - Ana sayfaya dönüş linki header'da bulunmalı
 * - Breadcrumb navigasyonu mevcut konumu doğru göstermeli
 *
 * **Validates: Requirements 12.1, 12.3, 12.4**
 *
 * @jest-environment jsdom
 */
import * as fc from 'fast-check';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
  return MockLink;
});

// Import components after mocks
import { BackButton, BackButtonProps } from '@/components/navigation/BackButton';
import { Breadcrumb, BreadcrumbItem } from '@/components/navigation/Breadcrumb';

// Test için geçerli URL'ler oluşturan arbitrary
const validUrlArbitrary = fc.oneof(
  fc.constant('/'),
  fc.constant('/penalties'),
  fc.constant('/penalties/yazili'),
  fc.constant('/penalties/sesli'),
  fc.constant('/commands'),
  fc.constant('/procedures'),
  fc.constant('/guide'),
  fc.constant('/admin'),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'), { minLength: 1, maxLength: 20 })
    .map(s => `/${s}`)
);

// Geçerli label oluşturan arbitrary (whitespace olmadan)
const validLabelArbitrary = fc.stringOf(
  fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
  { minLength: 1, maxLength: 50 }
);

// BreadcrumbItem oluşturan arbitrary
const breadcrumbItemArbitrary: fc.Arbitrary<BreadcrumbItem> = fc.record({
  label: validLabelArbitrary,
  href: validUrlArbitrary,
});

// Breadcrumb items dizisi oluşturan arbitrary (1-5 öğe)
const breadcrumbItemsArbitrary = fc.array(breadcrumbItemArbitrary, { minLength: 1, maxLength: 5 });

// Her test sonrası temizlik
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('Feature: yetkili-kilavuzu, Property 13: Navigasyon Tutarlılığı', () => {
  /**
   * Property 13a: BackButton her zaman render edilmeli
   *
   * *Herhangi bir* BackButton props kombinasyonu için,
   * bileşen her zaman görünür olmalıdır.
   *
   * **Validates: Requirements 12.1**
   */
  describe('Property 13a: BackButton her zaman render edilmeli', () => {
    it('BackButton varsayılan props ile her zaman render edilmeli', async () => {
      await fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          cleanup();
          const { container } = render(<BackButton />);
          
          // Property 1: Bileşen render edilmeli
          expect(container.firstChild).not.toBeNull();
          
          // Property 2: Buton elementi bulunmalı
          const button = container.querySelector('button');
          expect(button).not.toBeNull();
          
          // Property 3: Varsayılan "Geri" metni görünmeli
          expect(screen.getByText('Geri')).toBeInTheDocument();
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('BackButton özel label ile her zaman render edilmeli', async () => {
      await fc.assert(
        fc.property(validLabelArbitrary, (label) => {
          cleanup();
          const { container } = render(<BackButton label={label} />);
          
          // Property 1: Bileşen render edilmeli
          expect(container.firstChild).not.toBeNull();
          
          // Property 2: Buton elementi bulunmalı
          const button = container.querySelector('button');
          expect(button).not.toBeNull();
          
          // Property 3: Özel label görünmeli
          expect(screen.getByText(label)).toBeInTheDocument();
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('BackButton özel fallbackUrl ile her zaman render edilmeli', async () => {
      await fc.assert(
        fc.property(validUrlArbitrary, (fallbackUrl) => {
          cleanup();
          const { container } = render(<BackButton fallbackUrl={fallbackUrl} />);
          
          // Property 1: Bileşen render edilmeli
          expect(container.firstChild).not.toBeNull();
          
          // Property 2: Buton elementi bulunmalı
          const button = container.querySelector('button');
          expect(button).not.toBeNull();
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('BackButton tüm props kombinasyonları ile render edilmeli', async () => {
      await fc.assert(
        fc.property(
          validUrlArbitrary,
          validLabelArbitrary,
          (fallbackUrl, label) => {
            cleanup();
            const { container } = render(
              <BackButton fallbackUrl={fallbackUrl} label={label} />
            );
            
            // Property 1: Bileşen render edilmeli
            expect(container.firstChild).not.toBeNull();
            
            // Property 2: Buton elementi bulunmalı
            const button = container.querySelector('button');
            expect(button).not.toBeNull();
            
            // Property 3: Özel label görünmeli
            expect(screen.getByText(label)).toBeInTheDocument();
            
            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13b: BackButton her zaman tıklanabilir olmalı
   *
   * *Herhangi bir* BackButton için, buton her zaman
   * tıklanabilir durumda olmalıdır.
   *
   * **Validates: Requirements 12.1, 12.2**
   */
  describe('Property 13b: BackButton her zaman tıklanabilir olmalı', () => {
    it('BackButton disabled olmamalı', async () => {
      await fc.assert(
        fc.property(
          fc.option(validUrlArbitrary, { nil: undefined }),
          fc.option(validLabelArbitrary, { nil: undefined }),
          (fallbackUrl, label) => {
            cleanup();
            const props: BackButtonProps = {};
            if (fallbackUrl) props.fallbackUrl = fallbackUrl;
            if (label) props.label = label;
            
            const { container } = render(<BackButton {...props} />);
            
            const button = container.querySelector('button');
            
            // Property: Buton disabled olmamalı
            expect(button).not.toBeNull();
            expect(button).not.toBeDisabled();
            
            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13c: Breadcrumb her zaman mevcut konumu göstermeli
   *
   * *Herhangi bir* geçerli breadcrumb items dizisi için,
   * son öğe mevcut konum olarak gösterilmelidir.
   *
   * **Validates: Requirements 12.4**
   */
  describe('Property 13c: Breadcrumb mevcut konumu doğru göstermeli', () => {
    it('Breadcrumb son öğeyi mevcut konum olarak göstermeli', async () => {
      await fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          cleanup();
          const { container } = render(<Breadcrumb items={items} />);
          
          // Property 1: Bileşen render edilmeli
          expect(container.firstChild).not.toBeNull();
          
          // Property 2: Son öğe aria-current="page" ile işaretlenmeli
          const lastItem = items[items.length - 1];
          const currentPageElement = container.querySelector('[aria-current="page"]');
          expect(currentPageElement).not.toBeNull();
          expect(currentPageElement?.textContent).toContain(lastItem.label);
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('Breadcrumb tüm öğeleri sırayla göstermeli', async () => {
      await fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          cleanup();
          const { container } = render(<Breadcrumb items={items} />);
          
          // Property: Tüm label'lar görünmeli (queryAllByText ile duplicate'leri handle et)
          items.forEach((item) => {
            const elements = screen.queryAllByText(item.label);
            expect(elements.length).toBeGreaterThan(0);
          });
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13d: Breadcrumb navigasyon linkleri doğru olmalı
   *
   * *Herhangi bir* breadcrumb items dizisi için,
   * son öğe hariç tüm öğeler tıklanabilir link olmalıdır.
   *
   * **Validates: Requirements 12.4**
   */
  describe('Property 13d: Breadcrumb navigasyon linkleri doğru olmalı', () => {
    it('Breadcrumb son öğe hariç tüm öğeler link olmalı', async () => {
      await fc.assert(
        fc.property(
          fc.array(breadcrumbItemArbitrary, { minLength: 2, maxLength: 5 }),
          (items) => {
            cleanup();
            const { container } = render(<Breadcrumb items={items} />);
            
            // Son öğe hariç tüm öğeler için link kontrolü
            const links = container.querySelectorAll('a');
            
            // Property: Link sayısı items.length - 1 olmalı (son öğe link değil)
            expect(links.length).toBe(items.length - 1);
            
            // Property: Her link doğru href'e sahip olmalı
            items.slice(0, -1).forEach((item, index) => {
              expect(links[index]).toHaveAttribute('href', item.href);
            });
            
            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('Breadcrumb tek öğe olduğunda link olmamalı', async () => {
      await fc.assert(
        fc.property(breadcrumbItemArbitrary, (item) => {
          cleanup();
          const { container } = render(<Breadcrumb items={[item]} />);
          
          // Property: Tek öğe olduğunda link olmamalı
          const links = container.querySelectorAll('a');
          expect(links.length).toBe(0);
          
          // Property: Öğe aria-current="page" ile işaretlenmeli
          const currentPageElement = container.querySelector('[aria-current="page"]');
          expect(currentPageElement).not.toBeNull();
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13e: Breadcrumb boş dizi için null döndürmeli
   *
   * *Herhangi bir* boş items dizisi için,
   * Breadcrumb bileşeni null döndürmelidir.
   *
   * **Validates: Requirements 12.4**
   */
  describe('Property 13e: Breadcrumb boş dizi için null döndürmeli', () => {
    it('Breadcrumb boş dizi ile null döndürmeli', async () => {
      await fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          cleanup();
          const { container } = render(<Breadcrumb items={[]} />);
          
          // Property: Boş dizi için içerik olmamalı
          expect(container.firstChild).toBeNull();
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13f: Breadcrumb ayırıcıları doğru göstermeli
   *
   * *Herhangi bir* birden fazla öğeli breadcrumb için,
   * öğeler arasında ayırıcı (chevron) gösterilmelidir.
   *
   * **Validates: Requirements 12.4**
   */
  describe('Property 13f: Breadcrumb ayırıcıları doğru göstermeli', () => {
    it('Breadcrumb öğeler arasında ayırıcı göstermeli', async () => {
      await fc.assert(
        fc.property(
          fc.array(breadcrumbItemArbitrary, { minLength: 2, maxLength: 5 }),
          (items) => {
            cleanup();
            const { container } = render(<Breadcrumb items={items} />);
            
            // Property: Ayırıcı li elementleri sayısı items.length - 1 olmalı
            // (SVG'ler de aria-hidden içerdiği için li[aria-hidden] kullanıyoruz)
            const separatorLis = container.querySelectorAll('li[aria-hidden="true"]');
            expect(separatorLis.length).toBe(items.length - 1);
            
            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13g: Breadcrumb erişilebilirlik özelliklerine sahip olmalı
   *
   * *Herhangi bir* breadcrumb için, nav elementi
   * aria-label ile işaretlenmelidir.
   *
   * **Validates: Requirements 12.4**
   */
  describe('Property 13g: Breadcrumb erişilebilirlik özelliklerine sahip olmalı', () => {
    it('Breadcrumb nav elementi aria-label içermeli', async () => {
      await fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          cleanup();
          const { container } = render(<Breadcrumb items={items} />);
          
          // Property: nav elementi aria-label içermeli
          const nav = container.querySelector('nav');
          expect(nav).not.toBeNull();
          expect(nav).toHaveAttribute('aria-label');
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13h: BackButton icon içermeli
   *
   * *Herhangi bir* BackButton için, geri ok ikonu
   * görünür olmalıdır.
   *
   * **Validates: Requirements 12.1**
   */
  describe('Property 13h: BackButton icon içermeli', () => {
    it('BackButton geri ok ikonu içermeli', async () => {
      await fc.assert(
        fc.property(
          fc.option(validLabelArbitrary, { nil: undefined }),
          (label) => {
            cleanup();
            const { container } = render(
              <BackButton label={label || 'Geri'} />
            );
            
            // Property: SVG ikonu bulunmalı (ArrowLeft)
            const svg = container.querySelector('svg');
            expect(svg).not.toBeNull();
            
            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 13i: Breadcrumb showHomeIcon prop'u çalışmalı
   *
   * *Herhangi bir* breadcrumb için, showHomeIcon prop'u
   * ana sayfa ikonunu kontrol etmelidir.
   *
   * **Validates: Requirements 12.3, 12.4**
   */
  describe('Property 13i: Breadcrumb showHomeIcon prop çalışmalı', () => {
    it('Breadcrumb showHomeIcon=true ile home ikonu göstermeli', async () => {
      await fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          cleanup();
          const { container } = render(
            <Breadcrumb items={items} showHomeIcon={true} />
          );
          
          // Property: Home ikonu (SVG) bulunmalı
          const svgs = container.querySelectorAll('svg');
          expect(svgs.length).toBeGreaterThan(0);
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('Breadcrumb showHomeIcon=false ile home ikonu göstermemeli', async () => {
      await fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          cleanup();
          const { container } = render(
            <Breadcrumb items={items} showHomeIcon={false} />
          );
          
          // Property: Home ikonu olmamalı (sadece chevron ikonları olabilir)
          // Chevron sayısı items.length - 1 olmalı
          const svgs = container.querySelectorAll('svg');
          expect(svgs.length).toBe(items.length - 1);
          
          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });
});
