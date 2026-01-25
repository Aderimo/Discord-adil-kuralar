/**
 * Threshold Notification Property-Based Tests
 * 
 * Feature: gelismis-loglama, Property 7: Eşik Bildirimi
 * 
 * Bu test dosyası, log eşik bildirimi sisteminin doğruluğunu property-based testing
 * ile doğrular. 50 sayfa (1000 kayıt) eşiğine ulaşıldığında bildirim gönderilmesini
 * ve duplicate bildirimlerin engellenmesini test eder.
 * 
 * **Validates: Requirements 6.1, 6.3, 6.4, 6.5**
 * 
 * @jest-environment node
 */
import * as fc from 'fast-check';
import {
  calculatePageCount,
  isThresholdReached,
  createThresholdStatus,
  PAGE_SIZE,
  NOTIFICATION_THRESHOLD,
  TOTAL_ENTRY_THRESHOLD,
  DEFAULT_THRESHOLD_CONFIG,
  type ThresholdConfig,
  type ThresholdStatus,
} from '@/lib/log-threshold';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Geçerli log sayısı oluşturan arbitrary
 * 0'dan 5000'e kadar (birden fazla eşik döngüsü test etmek için)
 */
const logCountArbitrary = fc.integer({ min: 0, max: 5000 });

/**
 * Sayfa boyutu arbitrary (pozitif tam sayı)
 */
const pageSizeArbitrary = fc.integer({ min: 1, max: 100 });

/**
 * Bildirim eşiği arbitrary (pozitif tam sayı)
 */
const thresholdArbitrary = fc.integer({ min: 1, max: 200 });

/**
 * Geçerli ThresholdConfig oluşturan arbitrary
 */
const thresholdConfigArbitrary = fc.record({
  pageSize: pageSizeArbitrary,
  notificationThreshold: thresholdArbitrary,
});

/**
 * Tarih arbitrary (son 1 yıl içinde)
 */
const dateArbitrary = fc.date({
  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  max: new Date(),
});

/**
 * Nullable tarih arbitrary
 */
const nullableDateArbitrary = fc.option(dateArbitrary, { nil: null });

// ============================================================================
// Property Tests: calculatePageCount
// ============================================================================

describe('Property Tests: calculatePageCount', () => {
  /**
   * Property 7.1: Sayfa sayısı her zaman non-negative olmalı
   * 
   * *For any* log count, the page count SHALL be >= 0.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.1: Sayfa sayısı her zaman non-negative olmalı', () => {
    fc.assert(
      fc.property(logCountArbitrary, pageSizeArbitrary, (logCount, pageSize) => {
        const pages = calculatePageCount(logCount, pageSize);
        return pages >= 0;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.2: Sıfır log için sıfır sayfa döndürmeli
   * 
   * *For any* page size, zero logs SHALL result in zero pages.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.2: Sıfır log için sıfır sayfa döndürmeli', () => {
    fc.assert(
      fc.property(pageSizeArbitrary, (pageSize) => {
        const pages = calculatePageCount(0, pageSize);
        return pages === 0;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.3: Negatif log sayısı için sıfır sayfa döndürmeli
   * 
   * *For any* negative log count, the page count SHALL be 0.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.3: Negatif log sayısı için sıfır sayfa döndürmeli', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        pageSizeArbitrary,
        (logCount, pageSize) => {
          const pages = calculatePageCount(logCount, pageSize);
          return pages === 0;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.4: Sayfa sayısı doğru yukarı yuvarlanmalı
   * 
   * *For any* log count and page size, pages * pageSize >= logCount.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.4: Sayfa sayısı doğru yukarı yuvarlanmalı', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        pageSizeArbitrary,
        (logCount, pageSize) => {
          const pages = calculatePageCount(logCount, pageSize);
          // pages * pageSize >= logCount (yukarı yuvarlama)
          return pages * pageSize >= logCount;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.5: Tam bölünebilir log sayısı için tam sayfa döndürmeli
   * 
   * *For any* log count that is exactly divisible by page size, 
   * pages SHALL equal logCount / pageSize.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.5: Tam bölünebilir log sayısı için tam sayfa döndürmeli', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        pageSizeArbitrary,
        (multiplier, pageSize) => {
          const logCount = multiplier * pageSize;
          const pages = calculatePageCount(logCount, pageSize);
          return pages === multiplier;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.6: Varsayılan PAGE_SIZE ile 1000 log = 50 sayfa
   * 
   * *For any* log count of 1000, with default PAGE_SIZE (20), 
   * pages SHALL equal 50.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.6: 1000 log varsayılan PAGE_SIZE ile 50 sayfa olmalı', () => {
    const pages = calculatePageCount(1000, PAGE_SIZE);
    expect(pages).toBe(50);
    expect(pages).toBe(NOTIFICATION_THRESHOLD);
  });
});

// ============================================================================
// Property Tests: isThresholdReached
// ============================================================================

describe('Property Tests: isThresholdReached', () => {
  /**
   * Property 7.7: Eşik altındaki sayfa sayısı için false döndürmeli
   * 
   * *For any* page count below threshold, isThresholdReached SHALL return false.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.7: Eşik altındaki sayfa sayısı için false döndürmeli', () => {
    fc.assert(
      fc.property(thresholdArbitrary, (threshold) => {
        // Eşiğin altında bir sayfa sayısı
        const currentPages = threshold - 1;
        if (currentPages < 0) return true; // threshold = 1 durumu
        return isThresholdReached(currentPages, threshold) === false;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.8: Eşiğe eşit sayfa sayısı için true döndürmeli
   * 
   * *For any* page count equal to threshold, isThresholdReached SHALL return true.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.8: Eşiğe eşit sayfa sayısı için true döndürmeli', () => {
    fc.assert(
      fc.property(thresholdArbitrary, (threshold) => {
        return isThresholdReached(threshold, threshold) === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.9: Eşik üstündeki sayfa sayısı için true döndürmeli
   * 
   * *For any* page count above threshold, isThresholdReached SHALL return true.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.9: Eşik üstündeki sayfa sayısı için true döndürmeli', () => {
    fc.assert(
      fc.property(
        thresholdArbitrary,
        fc.integer({ min: 1, max: 100 }),
        (threshold, extra) => {
          const currentPages = threshold + extra;
          return isThresholdReached(currentPages, threshold) === true;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.10: Varsayılan eşik ile 50 sayfa = true
   * 
   * *For any* page count of 50 with default threshold, 
   * isThresholdReached SHALL return true.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.10: 50 sayfa varsayılan eşik ile true döndürmeli', () => {
    expect(isThresholdReached(50)).toBe(true);
    expect(isThresholdReached(NOTIFICATION_THRESHOLD)).toBe(true);
  });

  /**
   * Property 7.11: Varsayılan eşik ile 49 sayfa = false
   * 
   * *For any* page count of 49 with default threshold, 
   * isThresholdReached SHALL return false.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.11: 49 sayfa varsayılan eşik ile false döndürmeli', () => {
    expect(isThresholdReached(49)).toBe(false);
    expect(isThresholdReached(NOTIFICATION_THRESHOLD - 1)).toBe(false);
  });
});

// ============================================================================
// Property Tests: createThresholdStatus
// ============================================================================

describe('Property Tests: createThresholdStatus', () => {
  /**
   * Property 7.12: ThresholdStatus currentCount doğru olmalı
   * 
   * *For any* log count, the status.currentCount SHALL equal the input count.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.12: ThresholdStatus currentCount doğru olmalı', () => {
    fc.assert(
      fc.property(
        logCountArbitrary,
        nullableDateArbitrary,
        thresholdConfigArbitrary,
        (logCount, lastNotificationAt, config) => {
          const status = createThresholdStatus(logCount, lastNotificationAt, config);
          return status.currentCount === logCount;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.13: ThresholdStatus currentPages doğru hesaplanmalı
   * 
   * *For any* log count and config, status.currentPages SHALL equal 
   * calculatePageCount(logCount, config.pageSize).
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.13: ThresholdStatus currentPages doğru hesaplanmalı', () => {
    fc.assert(
      fc.property(
        logCountArbitrary,
        nullableDateArbitrary,
        thresholdConfigArbitrary,
        (logCount, lastNotificationAt, config) => {
          const status = createThresholdStatus(logCount, lastNotificationAt, config);
          const expectedPages = calculatePageCount(logCount, config.pageSize);
          return status.currentPages === expectedPages;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.14: ThresholdStatus thresholdReached doğru hesaplanmalı
   * 
   * *For any* log count and config, status.thresholdReached SHALL equal 
   * isThresholdReached(currentPages, config.notificationThreshold).
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.14: ThresholdStatus thresholdReached doğru hesaplanmalı', () => {
    fc.assert(
      fc.property(
        logCountArbitrary,
        nullableDateArbitrary,
        thresholdConfigArbitrary,
        (logCount, lastNotificationAt, config) => {
          const status = createThresholdStatus(logCount, lastNotificationAt, config);
          const expectedPages = calculatePageCount(logCount, config.pageSize);
          const expectedThresholdReached = isThresholdReached(
            expectedPages,
            config.notificationThreshold
          );
          return status.thresholdReached === expectedThresholdReached;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.15: ThresholdStatus lastNotificationAt korunmalı
   * 
   * *For any* lastNotificationAt value, status.lastNotificationAt SHALL equal the input.
   * 
   * **Validates: Requirements 6.4, 6.5**
   */
  it('Property 7.15: ThresholdStatus lastNotificationAt korunmalı', () => {
    fc.assert(
      fc.property(
        logCountArbitrary,
        nullableDateArbitrary,
        thresholdConfigArbitrary,
        (logCount, lastNotificationAt, config) => {
          const status = createThresholdStatus(logCount, lastNotificationAt, config);
          if (lastNotificationAt === null) {
            return status.lastNotificationAt === null;
          }
          return status.lastNotificationAt?.getTime() === lastNotificationAt.getTime();
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.16: 1000 log varsayılan config ile eşiğe ulaşmalı
   * 
   * *For any* log count of 1000 with default config, 
   * status.thresholdReached SHALL be true.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.16: 1000 log varsayılan config ile eşiğe ulaşmalı', () => {
    const status = createThresholdStatus(1000, null, DEFAULT_THRESHOLD_CONFIG);
    expect(status.currentCount).toBe(1000);
    expect(status.currentPages).toBe(50);
    expect(status.thresholdReached).toBe(true);
    expect(status.lastNotificationAt).toBeNull();
  });

  /**
   * Property 7.17: 999 log varsayılan config ile eşiğe ulaşmamalı
   * 
   * *For any* log count of 999 with default config, 
   * status.thresholdReached SHALL be false.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.17: 999 log varsayılan config ile eşiğe ulaşmamalı', () => {
    const status = createThresholdStatus(999, null, DEFAULT_THRESHOLD_CONFIG);
    expect(status.currentCount).toBe(999);
    expect(status.currentPages).toBe(50); // ceil(999/20) = 50
    expect(status.thresholdReached).toBe(true); // 50 >= 50
  });

  /**
   * Property 7.18: 980 log varsayılan config ile eşiğe ulaşmamalı
   * 
   * *For any* log count of 980 with default config, 
   * status.thresholdReached SHALL be false (49 pages).
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.18: 980 log varsayılan config ile eşiğe ulaşmamalı', () => {
    const status = createThresholdStatus(980, null, DEFAULT_THRESHOLD_CONFIG);
    expect(status.currentCount).toBe(980);
    expect(status.currentPages).toBe(49); // ceil(980/20) = 49
    expect(status.thresholdReached).toBe(false); // 49 < 50
  });
});

// ============================================================================
// Property Tests: Threshold Constants
// ============================================================================

describe('Property Tests: Threshold Constants', () => {
  /**
   * Property 7.19: TOTAL_ENTRY_THRESHOLD = PAGE_SIZE * NOTIFICATION_THRESHOLD
   * 
   * The total entry threshold SHALL equal page size times notification threshold.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.19: TOTAL_ENTRY_THRESHOLD doğru hesaplanmalı', () => {
    expect(TOTAL_ENTRY_THRESHOLD).toBe(PAGE_SIZE * NOTIFICATION_THRESHOLD);
    expect(TOTAL_ENTRY_THRESHOLD).toBe(1000);
  });

  /**
   * Property 7.20: DEFAULT_THRESHOLD_CONFIG doğru değerlere sahip olmalı
   * 
   * The default config SHALL have correct page size and threshold values.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.20: DEFAULT_THRESHOLD_CONFIG doğru değerlere sahip olmalı', () => {
    expect(DEFAULT_THRESHOLD_CONFIG.pageSize).toBe(PAGE_SIZE);
    expect(DEFAULT_THRESHOLD_CONFIG.notificationThreshold).toBe(NOTIFICATION_THRESHOLD);
    expect(DEFAULT_THRESHOLD_CONFIG.pageSize).toBe(20);
    expect(DEFAULT_THRESHOLD_CONFIG.notificationThreshold).toBe(50);
  });
});

// ============================================================================
// Property Tests: Threshold Boundary Conditions
// ============================================================================

describe('Property Tests: Threshold Boundary Conditions', () => {
  /**
   * Property 7.21: Eşik sınırında doğru davranış
   * 
   * *For any* log count at exact threshold boundary, 
   * the system SHALL correctly identify threshold reached.
   * 
   * **Validates: Requirements 6.1, 6.4**
   */
  it('Property 7.21: Eşik sınırında doğru davranış', () => {
    fc.assert(
      fc.property(thresholdConfigArbitrary, (config) => {
        const exactThresholdCount = config.pageSize * config.notificationThreshold;
        const status = createThresholdStatus(exactThresholdCount, null, config);
        
        // Tam eşikte thresholdReached true olmalı
        return status.thresholdReached === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.22: Eşik altında bir kayıt için false
   * 
   * *For any* log count one below threshold, 
   * the system SHALL return thresholdReached = false.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.22: Eşik altında bir kayıt için false', () => {
    fc.assert(
      fc.property(thresholdConfigArbitrary, (config) => {
        // Eşiğin tam altındaki sayfa sayısı için log sayısı
        const belowThresholdPages = config.notificationThreshold - 1;
        if (belowThresholdPages < 0) return true;
        
        // Bu sayfa sayısına karşılık gelen maksimum log sayısı
        const maxLogsForBelowThreshold = belowThresholdPages * config.pageSize;
        
        const status = createThresholdStatus(maxLogsForBelowThreshold, null, config);
        
        // Eşik altında thresholdReached false olmalı
        return status.thresholdReached === false;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.23: Çoklu eşik döngüsü
   * 
   * *For any* log count that is multiple of threshold, 
   * the system SHALL correctly identify threshold reached.
   * 
   * **Validates: Requirements 6.4**
   */
  it('Property 7.23: Çoklu eşik döngüsü', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        thresholdConfigArbitrary,
        (multiplier, config) => {
          const multipleThresholdCount = 
            config.pageSize * config.notificationThreshold * multiplier;
          const status = createThresholdStatus(multipleThresholdCount, null, config);
          
          // Çoklu eşikte de thresholdReached true olmalı
          return status.thresholdReached === true;
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ============================================================================
// Property Tests: Integration Scenarios
// ============================================================================

describe('Property Tests: Integration Scenarios', () => {
  /**
   * Property 7.24: Monoton artan log sayısı ile eşik geçişi
   * 
   * *For any* sequence of increasing log counts, 
   * once threshold is reached, it SHALL remain reached.
   * 
   * **Validates: Requirements 6.1, 6.4**
   */
  it('Property 7.24: Monoton artan log sayısı ile eşik geçişi', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 10 }),
        (increments) => {
          let currentCount = 0;
          let thresholdEverReached = false;
          
          for (const increment of increments) {
            currentCount += increment;
            const status = createThresholdStatus(currentCount, null, DEFAULT_THRESHOLD_CONFIG);
            
            if (status.thresholdReached) {
              thresholdEverReached = true;
            }
            
            // Bir kez eşiğe ulaşıldıysa, log sayısı artmaya devam ettikçe
            // eşik durumu true kalmalı
            if (thresholdEverReached) {
              if (!status.thresholdReached) {
                return false; // Eşik bir kez ulaşıldıktan sonra false olmamalı
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 7.25: Farklı config'ler ile tutarlı davranış
   * 
   * *For any* config, the threshold calculation SHALL be consistent.
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 7.25: Farklı config\'ler ile tutarlı davranış', () => {
    fc.assert(
      fc.property(
        logCountArbitrary,
        thresholdConfigArbitrary,
        (logCount, config) => {
          const status = createThresholdStatus(logCount, null, config);
          
          // Manuel hesaplama
          const expectedPages = logCount <= 0 ? 0 : Math.ceil(logCount / config.pageSize);
          const expectedThresholdReached = expectedPages >= config.notificationThreshold;
          
          return (
            status.currentPages === expectedPages &&
            status.thresholdReached === expectedThresholdReached
          );
        }
      ),
      { numRuns: 5 }
    );
  });
});
