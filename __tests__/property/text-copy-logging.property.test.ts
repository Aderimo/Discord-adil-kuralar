/**
 * Property 12: Metin Kopyalama Loglama - Property-Based Tests
 * 
 * Feature: gelismis-loglama, Property 12: Metin Kopyalama Loglama
 * 
 * Bu test dosyası, metin kopyalama loglamasının doğruluğunu property-based testing
 * ile doğrular. Tüm metin kopyalama olayları için log kaydının kopyalanan metin,
 * kaynak sayfa, element context ve selection pozisyonlarını içerdiğini test eder.
 * 
 * **Validates: Requirements 10.1, 10.2, 10.4**
 * 
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import {
  logTextCopy,
  truncateCopyText,
  COPY_TEXT_MAX_LENGTH,
  type TextCopyLog,
  type TextCopyDetails,
} from '@/lib/advanced-logging';
import { hashPassword } from '@/lib/auth';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = `copy_${Date.now().toString(36)}`;

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Test loglarını temizle
  await prisma.activityLog.deleteMany({
    where: {
      action: 'text_copy',
      details: {
        contains: testRunId,
      },
    },
  });
  // Test kullanıcılarını temizle
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: `_${testRunId}_`,
      },
    },
  });
  await prisma.$disconnect();
});

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Kopyalanan metin oluşturan arbitrary
 * Çeşitli uzunluklarda metinler
 */
const copiedTextArbitrary = fc.oneof(
  // Kısa metinler
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'), {
    minLength: 1,
    maxLength: 100,
  }),
  // Orta uzunlukta metinler
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'), {
    minLength: 100,
    maxLength: 400,
  }),
  // Uzun metinler (truncation test için)
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'), {
    minLength: 500,
    maxLength: 800,
  })
);

/**
 * Kaynak sayfa URL'si oluşturan arbitrary
 */
const sourcePageArbitrary = fc.constantFrom(
  '/guide',
  '/guide/introduction',
  '/penalties',
  '/penalties/category-1',
  '/procedures',
  '/procedures/step-1',
  '/commands',
  '/commands/admin',
  '/search',
  '/'
);

/**
 * Element context oluşturan arbitrary
 * Kopyalamanın yapıldığı HTML element bilgisi
 */
const elementContextArbitrary = fc.constantFrom(
  'p.content-text',
  'div.article-body',
  'span.highlight',
  'code.code-block',
  'li.list-item',
  'h1.title',
  'h2.subtitle',
  'blockquote.quote',
  'td.table-cell',
  'pre.code-snippet'
);

/**
 * Selection pozisyonları oluşturan arbitrary
 * Start her zaman end'den küçük veya eşit olmalı
 */
const selectionPositionsArbitrary = fc
  .tuple(
    fc.integer({ min: 0, max: 10000 }),
    fc.integer({ min: 0, max: 10000 })
  )
  .map(([a, b]) => ({
    start: Math.min(a, b),
    end: Math.max(a, b),
  }));

/**
 * Geçerli IPv4 adresi oluşturan arbitrary
 */
const validIPv4Arbitrary = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: Metin Kopyalama Loglama (Property 12)', () => {
  /**
   * Property 12.1: Kopyalanan Metin Kaydedilmeli
   * 
   * *For any* text copy event, the log entry SHALL contain the copied text.
   * 
   * **Validates: Requirements 10.1**
   */
  it(
    'Property 12.1: Kopyalanan metin log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedTextArbitrary,
            sourcePageArbitrary,
            elementContextArbitrary,
            selectionPositionsArbitrary,
            validIPv4Arbitrary,
            async (copiedText, sourcePage, elementContext, positions, ipAddress) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `testuser_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                  email: `test_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
                  passwordHash,
                  status: 'approved',
                },
              });
              createdUserIds.push(user.id);

              // Text copy bilgisi oluştur
              const copyInfo: TextCopyLog = {
                copiedText,
                sourcePage,
                elementContext,
                selectionStart: positions.start,
                selectionEnd: positions.end,
              };

              // Log kaydı oluştur
              const log = await logTextCopy(user.id, copyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde kopyalanan metin bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as TextCopyDetails;
              expect(details.copiedText).toBeDefined();

              // Property: Kopyalanan metin doğru şekilde kaydedilmeli (truncation dahil)
              const expectedText = copiedText.length > COPY_TEXT_MAX_LENGTH
                ? copiedText.substring(0, COPY_TEXT_MAX_LENGTH)
                : copiedText;
              expect(details.copiedText).toBe(expectedText);

              // Property: Action text_copy olmalı
              expect(log.action).toBe('text_copy');

              return true;
            }
          ),
          {
            numRuns: 5,
            verbose: false,
          }
        );
      } finally {
        // Temizlik
        if (createdLogIds.length > 0) {
          await prisma.activityLog.deleteMany({
            where: { id: { in: createdLogIds } },
          });
        }
        if (createdUserIds.length > 0) {
          await prisma.user.deleteMany({
            where: { id: { in: createdUserIds } },
          });
        }
      }
    },
    60000
  );

  /**
   * Property 12.2: Kaynak Sayfa ve Element Context Kaydedilmeli
   * 
   * *For any* text copy event, the log entry SHALL include the source page and element context.
   * 
   * **Validates: Requirements 10.2**
   */
  it(
    'Property 12.2: Kaynak sayfa ve element context log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedTextArbitrary,
            sourcePageArbitrary,
            elementContextArbitrary,
            selectionPositionsArbitrary,
            validIPv4Arbitrary,
            async (copiedText, sourcePage, elementContext, positions, ipAddress) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `testuser_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                  email: `test_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
                  passwordHash,
                  status: 'approved',
                },
              });
              createdUserIds.push(user.id);

              // Text copy bilgisi oluştur
              const copyInfo: TextCopyLog = {
                copiedText,
                sourcePage,
                elementContext,
                selectionStart: positions.start,
                selectionEnd: positions.end,
              };

              // Log kaydı oluştur
              const log = await logTextCopy(user.id, copyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde kaynak sayfa bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as TextCopyDetails;
              expect(details.sourcePage).toBeDefined();
              expect(details.sourcePage).toBe(sourcePage);

              // Property: Details içinde element context bulunmalı
              expect(details.elementContext).toBeDefined();
              expect(details.elementContext).toBe(elementContext);

              return true;
            }
          ),
          {
            numRuns: 5,
            verbose: false,
          }
        );
      } finally {
        // Temizlik
        if (createdLogIds.length > 0) {
          await prisma.activityLog.deleteMany({
            where: { id: { in: createdLogIds } },
          });
        }
        if (createdUserIds.length > 0) {
          await prisma.user.deleteMany({
            where: { id: { in: createdUserIds } },
          });
        }
      }
    },
    60000
  );

  /**
   * Property 12.3: Selection Start ve End Pozisyonları Kaydedilmeli
   * 
   * *For any* text copy event, the log entry SHALL record the selection start and end positions.
   * 
   * **Validates: Requirements 10.4**
   */
  it(
    'Property 12.3: Selection start ve end pozisyonları log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedTextArbitrary,
            sourcePageArbitrary,
            elementContextArbitrary,
            selectionPositionsArbitrary,
            validIPv4Arbitrary,
            async (copiedText, sourcePage, elementContext, positions, ipAddress) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `testuser_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                  email: `test_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
                  passwordHash,
                  status: 'approved',
                },
              });
              createdUserIds.push(user.id);

              // Text copy bilgisi oluştur
              const copyInfo: TextCopyLog = {
                copiedText,
                sourcePage,
                elementContext,
                selectionStart: positions.start,
                selectionEnd: positions.end,
              };

              // Log kaydı oluştur
              const log = await logTextCopy(user.id, copyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde selection pozisyonları bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as TextCopyDetails;
              
              // Property: selectionStart kaydedilmeli
              expect(details.selectionStart).toBeDefined();
              expect(typeof details.selectionStart).toBe('number');
              expect(details.selectionStart).toBe(positions.start);

              // Property: selectionEnd kaydedilmeli
              expect(details.selectionEnd).toBeDefined();
              expect(typeof details.selectionEnd).toBe('number');
              expect(details.selectionEnd).toBe(positions.end);

              // Property: selectionStart <= selectionEnd olmalı
              expect(details.selectionStart).toBeLessThanOrEqual(details.selectionEnd);

              return true;
            }
          ),
          {
            numRuns: 5,
            verbose: false,
          }
        );
      } finally {
        // Temizlik
        if (createdLogIds.length > 0) {
          await prisma.activityLog.deleteMany({
            where: { id: { in: createdLogIds } },
          });
        }
        if (createdUserIds.length > 0) {
          await prisma.user.deleteMany({
            where: { id: { in: createdUserIds } },
          });
        }
      }
    },
    60000
  );

  /**
   * Property 12.4: Tüm Gerekli Alanlar Tek Bir Log Kaydında Bulunmalı
   * 
   * *For any* text copy event, the log entry SHALL contain ALL required fields:
   * copied text, source page, element context, and selection positions.
   * 
   * **Validates: Requirements 10.1, 10.2, 10.4**
   */
  it(
    'Property 12.4: Tüm gerekli alanlar tek bir log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedTextArbitrary,
            sourcePageArbitrary,
            elementContextArbitrary,
            selectionPositionsArbitrary,
            validIPv4Arbitrary,
            async (copiedText, sourcePage, elementContext, positions, ipAddress) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `testuser_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                  email: `test_${testRunId}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
                  passwordHash,
                  status: 'approved',
                },
              });
              createdUserIds.push(user.id);

              // Text copy bilgisi oluştur
              const copyInfo: TextCopyLog = {
                copiedText,
                sourcePage,
                elementContext,
                selectionStart: positions.start,
                selectionEnd: positions.end,
              };

              // Log kaydı oluştur
              const log = await logTextCopy(user.id, copyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details tüm gerekli alanları içermeli
              expect(log.details).toBeDefined();
              const details = log.details as TextCopyDetails;

              // Property: Event türü doğru olmalı
              expect(details.event).toBe('text_copy');

              // Property: Kopyalanan metin bulunmalı (Requirement 10.1)
              expect(details.copiedText).toBeDefined();

              // Property: Kaynak sayfa bulunmalı (Requirement 10.2)
              expect(details.sourcePage).toBeDefined();
              expect(details.sourcePage).toBe(sourcePage);

              // Property: Element context bulunmalı (Requirement 10.2)
              expect(details.elementContext).toBeDefined();
              expect(details.elementContext).toBe(elementContext);

              // Property: Selection start bulunmalı (Requirement 10.4)
              expect(details.selectionStart).toBeDefined();
              expect(details.selectionStart).toBe(positions.start);

              // Property: Selection end bulunmalı (Requirement 10.4)
              expect(details.selectionEnd).toBeDefined();
              expect(details.selectionEnd).toBe(positions.end);

              // Property: Timestamp bulunmalı
              expect(details.timestamp).toBeDefined();
              expect(typeof details.timestamp).toBe('string');

              // Property: IP adresi kaydedilmeli
              expect(log.ipAddress).toBeDefined();
              expect(log.ipAddress).toBe(ipAddress);

              // Property: User ID kaydedilmeli
              expect(log.userId).toBe(user.id);

              return true;
            }
          ),
          {
            numRuns: 5,
            verbose: false,
          }
        );
      } finally {
        // Temizlik
        if (createdLogIds.length > 0) {
          await prisma.activityLog.deleteMany({
            where: { id: { in: createdLogIds } },
          });
        }
        if (createdUserIds.length > 0) {
          await prisma.user.deleteMany({
            where: { id: { in: createdUserIds } },
          });
        }
      }
    },
    60000
  );
});
