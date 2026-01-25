/**
 * Text Truncation Property-Based Tests
 * 
 * Feature: gelismis-loglama, Property 3: Metin Truncation
 * 
 * Bu test dosyası, metin truncation fonksiyonlarının doğruluğunu property-based testing
 * ile doğrular. Tüm metin türleri için (AI, input, copy) belirlenen limitlere göre
 * truncation işleminin doğru çalıştığını test eder.
 * 
 * **Validates: Requirements 2.4, 5.4, 10.3**
 * 
 * @jest-environment node
 */
import * as fc from 'fast-check';
import {
  truncateText,
  truncateAIText,
  truncateInputText,
  truncateCopyText,
  AI_TEXT_MAX_LENGTH,
  INPUT_TEXT_MAX_LENGTH,
  COPY_TEXT_MAX_LENGTH,
} from '@/lib/advanced-logging';

// ============================================================================
// Arbitraries for Truncation Tests
// ============================================================================

/**
 * AI metni için uzun metin oluşturan arbitrary (2000+ karakter)
 * Requirement 2.4: AI metinleri için 2000 karakter limiti
 */
const longAITextArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'),
  { minLength: 2001, maxLength: 3000 }
);

/**
 * AI metni için kısa metin oluşturan arbitrary (2000 veya daha az karakter)
 */
const shortAITextArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'),
  { minLength: 1, maxLength: 2000 }
);

/**
 * Input metni için uzun metin oluşturan arbitrary (1000+ karakter)
 * Requirement 5.4: Input metinleri için 1000 karakter limiti
 */
const longInputTextArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'),
  { minLength: 1001, maxLength: 2000 }
);

/**
 * Input metni için kısa metin oluşturan arbitrary (1000 veya daha az karakter)
 */
const shortInputTextArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'),
  { minLength: 1, maxLength: 1000 }
);

/**
 * Copy metni için uzun metin oluşturan arbitrary (500+ karakter)
 * Requirement 10.3: Kopyalanan metin için 500 karakter limiti
 */
const longCopyTextArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'),
  { minLength: 501, maxLength: 1000 }
);

/**
 * Copy metni için kısa metin oluşturan arbitrary (500 veya daha az karakter)
 */
const shortCopyTextArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'),
  { minLength: 1, maxLength: 500 }
);

// ============================================================================
// Property Tests: Metin Truncation (Property 3)
// Feature: gelismis-loglama, Property 3: Metin Truncation
// **Validates: Requirements 2.4, 5.4, 10.3**
// ============================================================================

describe('Property Tests: Metin Truncation (Property 3)', () => {
  /**
   * Property 3.1: AI Metinleri 2000 Karaktere Kısaltılmalı
   * 
   * *For any* AI text exceeding 2000 characters, the logged text SHALL be truncated to exactly 2000 characters.
   * 
   * **Validates: Requirements 2.4**
   */
  it(
    'Property 3.1: AI metinleri 2000 karakteri aşarsa tam olarak 2000 karaktere kısaltılmalı',
    () => {
      fc.assert(
        fc.property(longAITextArbitrary, (text) => {
          // Truncate işlemi uygula
          const truncated = truncateAIText(text);
          
          // Property: Sonuç tam olarak 2000 karakter olmalı
          expect(truncated.length).toBe(AI_TEXT_MAX_LENGTH);
          
          // Property: Kısaltılmış metin orijinal metnin başlangıcı olmalı
          expect(text.startsWith(truncated)).toBe(true);
          
          return true;
        }),
        { numRuns: 5 }
      );
    }
  );

  /**
   * Property 3.2: 2000 Karakter veya Daha Kısa AI Metinleri Değiştirilmemeli
   * 
   * *For any* AI text with 2000 or fewer characters, the logged text SHALL remain unchanged.
   * 
   * **Validates: Requirements 2.4**
   */
  it(
    'Property 3.2: 2000 karakter veya daha kısa AI metinleri değiştirilmemeli',
    () => {
      fc.assert(
        fc.property(shortAITextArbitrary, (text) => {
          // Truncate işlemi uygula
          const truncated = truncateAIText(text);
          
          // Property: Metin değişmemiş olmalı
          expect(truncated).toBe(text);
          expect(truncated.length).toBe(text.length);
          
          return true;
        }),
        { numRuns: 5 }
      );
    }
  );

  /**
   * Property 3.3: Input Metinleri 1000 Karaktere Kısaltılmalı
   * 
   * *For any* input text exceeding 1000 characters, the logged text SHALL be truncated to exactly 1000 characters.
   * 
   * **Validates: Requirements 5.4**
   */
  it(
    'Property 3.3: Input metinleri 1000 karakteri aşarsa tam olarak 1000 karaktere kısaltılmalı',
    () => {
      fc.assert(
        fc.property(longInputTextArbitrary, (text) => {
          // Truncate işlemi uygula
          const truncated = truncateInputText(text);
          
          // Property: Sonuç tam olarak 1000 karakter olmalı
          expect(truncated.length).toBe(INPUT_TEXT_MAX_LENGTH);
          
          // Property: Kısaltılmış metin orijinal metnin başlangıcı olmalı
          expect(text.startsWith(truncated)).toBe(true);
          
          return true;
        }),
        { numRuns: 5 }
      );
    }
  );

  /**
   * Property 3.4: 1000 Karakter veya Daha Kısa Input Metinleri Değiştirilmemeli
   * 
   * *For any* input text with 1000 or fewer characters, the logged text SHALL remain unchanged.
   * 
   * **Validates: Requirements 5.4**
   */
  it(
    'Property 3.4: 1000 karakter veya daha kısa input metinleri değiştirilmemeli',
    () => {
      fc.assert(
        fc.property(shortInputTextArbitrary, (text) => {
          // Truncate işlemi uygula
          const truncated = truncateInputText(text);
          
          // Property: Metin değişmemiş olmalı
          expect(truncated).toBe(text);
          expect(truncated.length).toBe(text.length);
          
          return true;
        }),
        { numRuns: 5 }
      );
    }
  );

  /**
   * Property 3.5: Kopyalanan Metinler 500 Karaktere Kısaltılmalı
   * 
   * *For any* copied text exceeding 500 characters, the logged text SHALL be truncated to exactly 500 characters.
   * 
   * **Validates: Requirements 10.3**
   */
  it(
    'Property 3.5: Kopyalanan metinler 500 karakteri aşarsa tam olarak 500 karaktere kısaltılmalı',
    () => {
      fc.assert(
        fc.property(longCopyTextArbitrary, (text) => {
          // Truncate işlemi uygula
          const truncated = truncateCopyText(text);
          
          // Property: Sonuç tam olarak 500 karakter olmalı
          expect(truncated.length).toBe(COPY_TEXT_MAX_LENGTH);
          
          // Property: Kısaltılmış metin orijinal metnin başlangıcı olmalı
          expect(text.startsWith(truncated)).toBe(true);
          
          return true;
        }),
        { numRuns: 5 }
      );
    }
  );

  /**
   * Property 3.6: 500 Karakter veya Daha Kısa Kopyalanan Metinler Değiştirilmemeli
   * 
   * *For any* copied text with 500 or fewer characters, the logged text SHALL remain unchanged.
   * 
   * **Validates: Requirements 10.3**
   */
  it(
    'Property 3.6: 500 karakter veya daha kısa kopyalanan metinler değiştirilmemeli',
    () => {
      fc.assert(
        fc.property(shortCopyTextArbitrary, (text) => {
          // Truncate işlemi uygula
          const truncated = truncateCopyText(text);
          
          // Property: Metin değişmemiş olmalı
          expect(truncated).toBe(text);
          expect(truncated.length).toBe(text.length);
          
          return true;
        }),
        { numRuns: 5 }
      );
    }
  );
});

// ============================================================================
// Unit-style Property Tests for Truncation Functions
// ============================================================================

describe('Property Tests: Truncation Fonksiyonları', () => {
  /**
   * Property: truncateText genel fonksiyonu doğru çalışmalı
   */
  it('truncateText herhangi bir limit için doğru çalışmalı', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }),
        fc.integer({ min: 1, max: 3000 }),
        (text, maxLength) => {
          const truncated = truncateText(text, maxLength);
          
          // Property: Sonuç hiçbir zaman maxLength'i aşmamalı
          expect(truncated.length).toBeLessThanOrEqual(maxLength);
          
          // Property: Eğer orijinal metin maxLength'den kısa veya eşitse, değişmemeli
          if (text.length <= maxLength) {
            expect(truncated).toBe(text);
          } else {
            // Property: Eğer orijinal metin maxLength'den uzunsa, tam olarak maxLength olmalı
            expect(truncated.length).toBe(maxLength);
            // Property: Kısaltılmış metin orijinal metnin başlangıcı olmalı
            expect(text.startsWith(truncated)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Boş metin için truncate fonksiyonları boş string döndürmeli
   */
  it('Boş metin için truncate fonksiyonları boş string döndürmeli', () => {
    expect(truncateAIText('')).toBe('');
    expect(truncateInputText('')).toBe('');
    expect(truncateCopyText('')).toBe('');
    expect(truncateText('', 100)).toBe('');
  });

  /**
   * Property: Null/undefined için truncate fonksiyonları boş string döndürmeli
   */
  it('Null/undefined için truncate fonksiyonları boş string döndürmeli', () => {
    expect(truncateText(null as unknown as string, 100)).toBe('');
    expect(truncateText(undefined as unknown as string, 100)).toBe('');
  });

  /**
   * Property: Truncation sabitleri doğru değerlere sahip olmalı
   */
  it('Truncation sabitleri doğru değerlere sahip olmalı', () => {
    // Requirement 2.4: AI metinleri için 2000 karakter
    expect(AI_TEXT_MAX_LENGTH).toBe(2000);
    
    // Requirement 5.4: Input metinleri için 1000 karakter
    expect(INPUT_TEXT_MAX_LENGTH).toBe(1000);
    
    // Requirement 10.3: Kopyalanan metin için 500 karakter
    expect(COPY_TEXT_MAX_LENGTH).toBe(500);
  });
});
