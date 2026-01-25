/**
 * Property 11: URL Kopyalama Loglama - Property-Based Tests
 * 
 * Feature: gelismis-loglama, Property 11: URL Kopyalama Loglama
 * 
 * Bu test dosyası, URL kopyalama loglamasının doğruluğunu property-based testing
 * ile doğrular. Tüm site URL kopyalama olayları için log kaydının kopyalama olayını
 * sayfa context'i ile birlikte içerdiğini test eder.
 * 
 * **Validates: Requirements 9.2**
 * 
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import {
  logURLCopy,
  type URLCopyLog,
  type URLCopyDetails,
} from '@/lib/advanced-logging';
import { hashPassword } from '@/lib/auth';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = `urlcopy_${Date.now().toString(36)}`;

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Test loglarını temizle
  await prisma.activityLog.deleteMany({
    where: {
      action: 'url_copy',
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
 * Site URL'si oluşturan arbitrary
 * Kopyalanan URL (site URL'si)
 */
const copiedUrlArbitrary = fc.constantFrom(
  'https://yetkili-kilavuzu.com',
  'https://yetkili-kilavuzu.com/guide',
  'https://yetkili-kilavuzu.com/guide/introduction',
  'https://yetkili-kilavuzu.com/penalties',
  'https://yetkili-kilavuzu.com/penalties/category-1',
  'https://yetkili-kilavuzu.com/procedures',
  'https://yetkili-kilavuzu.com/commands',
  'https://yetkili-kilavuzu.com/search?q=test',
  'http://localhost:3000',
  'http://localhost:3000/guide'
);

/**
 * Sayfa URL'si oluşturan arbitrary
 * Kopyalamanın yapıldığı sayfa
 */
const pageUrlArbitrary = fc.constantFrom(
  '/guide',
  '/guide/introduction',
  '/guide/getting-started',
  '/penalties',
  '/penalties/category-1',
  '/penalties/category-2',
  '/procedures',
  '/procedures/step-1',
  '/commands',
  '/commands/admin',
  '/search',
  '/'
);

/**
 * Sayfa başlığı oluşturan arbitrary
 */
const pageTitleArbitrary = fc.constantFrom(
  'Ana Sayfa - Yetkili Kılavuzu',
  'Kılavuz - Yetkili Kılavuzu',
  'Giriş - Yetkili Kılavuzu',
  'Cezalar - Yetkili Kılavuzu',
  'Prosedürler - Yetkili Kılavuzu',
  'Komutlar - Yetkili Kılavuzu',
  'Arama Sonuçları - Yetkili Kılavuzu',
  'Kategori 1 - Cezalar',
  'Admin Komutları - Yetkili Kılavuzu'
);

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

describe('Property Tests: URL Kopyalama Loglama (Property 11)', () => {
  /**
   * Property 11.1: URL Kopyalama Olayı Kaydedilmeli
   * 
   * *For any* site URL copy event, the log entry SHALL contain the copy event.
   * 
   * **Validates: Requirements 9.2**
   */
  it(
    'Property 11.1: URL kopyalama olayı log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedUrlArbitrary,
            pageUrlArbitrary,
            pageTitleArbitrary,
            validIPv4Arbitrary,
            async (copiedUrl, pageUrl, pageTitle, ipAddress) => {
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

              // URL copy bilgisi oluştur
              const urlCopyInfo: URLCopyLog = {
                copiedUrl,
                pageUrl,
                pageTitle,
              };

              // Log kaydı oluştur
              const log = await logURLCopy(user.id, urlCopyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Action url_copy olmalı
              expect(log.action).toBe('url_copy');

              // Property: Details içinde event türü url_copy olmalı
              expect(log.details).toBeDefined();
              const details = log.details as URLCopyDetails;
              expect(details.event).toBe('url_copy');

              // Property: Kopyalanan URL kaydedilmeli
              expect(details.copiedUrl).toBeDefined();
              expect(details.copiedUrl).toBe(copiedUrl);

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
   * Property 11.2: Sayfa Context'i Kaydedilmeli
   * 
   * *For any* site URL copy event, the log entry SHALL contain the page context
   * (page URL and page title).
   * 
   * **Validates: Requirements 9.2**
   */
  it(
    'Property 11.2: Sayfa context (pageUrl ve pageTitle) log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedUrlArbitrary,
            pageUrlArbitrary,
            pageTitleArbitrary,
            validIPv4Arbitrary,
            async (copiedUrl, pageUrl, pageTitle, ipAddress) => {
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

              // URL copy bilgisi oluştur
              const urlCopyInfo: URLCopyLog = {
                copiedUrl,
                pageUrl,
                pageTitle,
              };

              // Log kaydı oluştur
              const log = await logURLCopy(user.id, urlCopyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde sayfa URL'si bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as URLCopyDetails;
              expect(details.pageUrl).toBeDefined();
              expect(details.pageUrl).toBe(pageUrl);

              // Property: Details içinde sayfa başlığı bulunmalı
              expect(details.pageTitle).toBeDefined();
              expect(details.pageTitle).toBe(pageTitle);

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
   * Property 11.3: Tüm Gerekli Alanlar Tek Bir Log Kaydında Bulunmalı
   * 
   * *For any* site URL copy event, the log entry SHALL contain ALL required fields:
   * copied URL, page URL, page title, and timestamp.
   * 
   * **Validates: Requirements 9.2**
   */
  it(
    'Property 11.3: Tüm gerekli alanlar tek bir log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedUrlArbitrary,
            pageUrlArbitrary,
            pageTitleArbitrary,
            validIPv4Arbitrary,
            async (copiedUrl, pageUrl, pageTitle, ipAddress) => {
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

              // URL copy bilgisi oluştur
              const urlCopyInfo: URLCopyLog = {
                copiedUrl,
                pageUrl,
                pageTitle,
              };

              // Log kaydı oluştur
              const log = await logURLCopy(user.id, urlCopyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details tüm gerekli alanları içermeli
              expect(log.details).toBeDefined();
              const details = log.details as URLCopyDetails;

              // Property: Event türü doğru olmalı
              expect(details.event).toBe('url_copy');

              // Property: Kopyalanan URL bulunmalı
              expect(details.copiedUrl).toBeDefined();
              expect(details.copiedUrl).toBe(copiedUrl);

              // Property: Sayfa URL'si bulunmalı (page context)
              expect(details.pageUrl).toBeDefined();
              expect(details.pageUrl).toBe(pageUrl);

              // Property: Sayfa başlığı bulunmalı (page context)
              expect(details.pageTitle).toBeDefined();
              expect(details.pageTitle).toBe(pageTitle);

              // Property: Timestamp bulunmalı
              expect(details.timestamp).toBeDefined();
              expect(typeof details.timestamp).toBe('string');
              // Timestamp ISO formatında olmalı
              expect(() => new Date(details.timestamp)).not.toThrow();

              // Property: IP adresi kaydedilmeli
              expect(log.ipAddress).toBeDefined();
              expect(log.ipAddress).toBe(ipAddress);

              // Property: User ID kaydedilmeli
              expect(log.userId).toBe(user.id);

              // Property: Action url_copy olmalı
              expect(log.action).toBe('url_copy');

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
   * Property 11.4: Farklı URL ve Sayfa Kombinasyonları Doğru Kaydedilmeli
   * 
   * *For any* combination of copied URL and page context, the log entry SHALL
   * correctly preserve the relationship between the copied URL and the page
   * where the copy occurred.
   * 
   * **Validates: Requirements 9.2**
   */
  it(
    'Property 11.4: Farklı URL ve sayfa kombinasyonları doğru kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            copiedUrlArbitrary,
            pageUrlArbitrary,
            pageTitleArbitrary,
            validIPv4Arbitrary,
            async (copiedUrl, pageUrl, pageTitle, ipAddress) => {
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

              // URL copy bilgisi oluştur
              const urlCopyInfo: URLCopyLog = {
                copiedUrl,
                pageUrl,
                pageTitle,
              };

              // Log kaydı oluştur
              const log = await logURLCopy(user.id, urlCopyInfo, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();

              // Property: Details doğru şekilde parse edilebilmeli
              const details = log.details as URLCopyDetails;

              // Property: Kopyalanan URL ile sayfa URL'si farklı olabilir
              // (kullanıcı farklı bir sayfanın URL'sini kopyalayabilir)
              // Ama her ikisi de doğru şekilde kaydedilmeli
              expect(details.copiedUrl).toBe(copiedUrl);
              expect(details.pageUrl).toBe(pageUrl);

              // Property: Sayfa başlığı sayfa URL'si ile tutarlı olmalı
              // (başlık, kopyalamanın yapıldığı sayfanın başlığı)
              expect(details.pageTitle).toBe(pageTitle);

              // Property: Veritabanından log kaydını doğrula
              const dbLog = await prisma.activityLog.findUnique({
                where: { id: log.id },
              });
              expect(dbLog).toBeDefined();
              expect(dbLog?.action).toBe('url_copy');

              // Property: Details JSON olarak parse edilebilmeli
              const parsedDetails = JSON.parse(dbLog?.details || '{}');
              expect(parsedDetails.copiedUrl).toBe(copiedUrl);
              expect(parsedDetails.pageUrl).toBe(pageUrl);
              expect(parsedDetails.pageTitle).toBe(pageTitle);

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
