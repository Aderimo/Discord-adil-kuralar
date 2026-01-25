/**
 * Referrer Logging Property-Based Tests
 * 
 * Feature: gelismis-loglama, Property 10: Referrer Loglama
 * 
 * Bu test dosyası, referrer loglamasının doğruluğunu property-based testing
 * ile doğrular. Tüm external referrer'lar için log kaydının referrer URL,
 * source domain, source type ve source counter içerdiğini test eder.
 * 
 * **Validates: Requirements 9.1, 9.3, 9.4, 9.5**
 * 
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import {
  logReferrer,
  logReferrerFromUrl,
  extractDomain,
  classifySourceType,
  incrementSourceCounter,
  getSourceCounter,
  resetSourceCounters,
  SOCIAL_MEDIA_DOMAINS,
  SEARCH_ENGINE_DOMAINS,
  type VisitorInfo,
  type ReferrerLog,
  type ReferrerTrackDetails,
} from '@/lib/advanced-logging';
import { hashPassword } from '@/lib/auth';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = `ref_${Date.now().toString(36)}`;

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Test loglarını temizle
  await prisma.activityLog.deleteMany({
    where: {
      action: 'referrer_track',
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


// Her test öncesi source counter'ları sıfırla
beforeEach(() => {
  resetSourceCounters();
});

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

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

/**
 * User agent string oluşturan arbitrary
 */
const userAgentArbitrary = fc.constantFrom(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
  'curl/7.68.0',
  ''
);

/**
 * Session ID oluşturan arbitrary
 */
const sessionIdArbitrary = fc.oneof(
  fc.constant(null),
  fc.uuid()
);

/**
 * Sosyal medya referrer URL'si oluşturan arbitrary
 */
const socialMediaReferrerArbitrary = fc.constantFrom(
  'https://www.facebook.com/share/post123',
  'https://m.facebook.com/groups/test',
  'https://fb.com/page/link',
  'https://twitter.com/status/123456789',
  'https://x.com/user/post',
  'https://t.co/abc123xyz',
  'https://www.instagram.com/p/abc123',
  'https://www.linkedin.com/posts/user',
  'https://discord.com/channels/123/456',
  'https://discord.gg/invite123',
  'https://www.reddit.com/r/programming/comments/abc',
  'https://www.tiktok.com/@user/video/123',
  'https://www.youtube.com/watch?v=abc123',
  'https://youtu.be/abc123'
);

/**
 * Arama motoru referrer URL'si oluşturan arbitrary
 */
const searchEngineReferrerArbitrary = fc.constantFrom(
  'https://www.google.com/search?q=yetkili+kilavuzu',
  'https://google.com.tr/search?q=test',
  'https://www.bing.com/search?q=example',
  'https://search.yahoo.com/search?p=query',
  'https://duckduckgo.com/?q=privacy',
  'https://yandex.com/search/?text=test',
  'https://yandex.ru/search/?text=query',
  'https://www.baidu.com/s?wd=search'
);

/**
 * Diğer (other) referrer URL'si oluşturan arbitrary
 */
const otherReferrerArbitrary = fc.constantFrom(
  'https://example.com/link-to-site',
  'https://myblog.org/post/123',
  'https://news.site.net/article/abc',
  'https://forum.example.org/thread/456',
  'https://wiki.example.com/page',
  'https://docs.somesite.io/guide',
  'https://medium.com/@author/article',
  'https://dev.to/user/post'
);


/**
 * Tüm external referrer türlerini içeren arbitrary
 */
const externalReferrerArbitrary = fc.oneof(
  socialMediaReferrerArbitrary,
  searchEngineReferrerArbitrary,
  otherReferrerArbitrary
);

/**
 * Rastgele domain oluşturan arbitrary
 */
const randomDomainArbitrary = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 3, maxLength: 10 }),
    fc.constantFrom('.com', '.org', '.net', '.io', '.co', '.dev')
  )
  .map(([name, tld]) => `${name}${tld}`);

/**
 * Rastgele URL path oluşturan arbitrary
 */
const randomPathArbitrary = fc
  .array(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), { minLength: 1, maxLength: 10 }),
    { minLength: 0, maxLength: 3 }
  )
  .map((parts) => parts.length > 0 ? '/' + parts.join('/') : '');

/**
 * Rastgele tam URL oluşturan arbitrary
 */
const randomUrlArbitrary = fc
  .tuple(
    fc.constantFrom('https://', 'http://'),
    fc.constantFrom('', 'www.'),
    randomDomainArbitrary,
    randomPathArbitrary
  )
  .map(([protocol, www, domain, path]) => `${protocol}${www}${domain}${path}`);

// ============================================================================
// Property Tests - Property 10: Referrer Loglama
// **Validates: Requirements 9.1, 9.3, 9.4, 9.5**
// ============================================================================

describe('Property Tests: Referrer Loglama (Property 10)', () => {
  /**
   * Property 10.1: External Referrer URL Kaydedilmeli
   * 
   * *For any* external referrer, the log entry SHALL contain the referrer URL.
   * 
   * **Validates: Requirements 9.1**
   */
  it(
    'Property 10.1: External referrer URL log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            externalReferrerArbitrary,
            validIPv4Arbitrary,
            userAgentArbitrary,
            sessionIdArbitrary,
            async (referrerUrl, ipAddress, userAgent, sessionId) => {
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

              // Visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id,
                sessionId,
                userAgent,
                referrer: referrerUrl,
              };

              // Domain ve source type'ı hesapla
              const sourceDomain = extractDomain(referrerUrl);
              const sourceType = classifySourceType(referrerUrl);

              // ReferrerLog oluştur
              const referrer: ReferrerLog = {
                referrerUrl,
                sourceDomain,
                sourceType,
              };

              // Log kaydı oluştur
              const log = await logReferrer(visitorInfo, referrer);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde referrer URL bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as ReferrerTrackDetails;
              expect(details.referrerUrl).toBe(referrerUrl);

              // Property: Action referrer_track olmalı
              expect(log.action).toBe('referrer_track');

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
   * Property 10.2: Source Domain Çıkarılmalı ve Kaydedilmeli
   * 
   * *For any* external referrer, the log entry SHALL contain the extracted source domain.
   * 
   * **Validates: Requirements 9.3**
   */
  it(
    'Property 10.2: Source domain çıkarılmalı ve log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            externalReferrerArbitrary,
            validIPv4Arbitrary,
            userAgentArbitrary,
            sessionIdArbitrary,
            async (referrerUrl, ipAddress, userAgent, sessionId) => {
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

              // Visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id,
                sessionId,
                userAgent,
                referrer: referrerUrl,
              };

              // Beklenen domain'i hesapla
              const expectedDomain = extractDomain(referrerUrl);
              const sourceType = classifySourceType(referrerUrl);

              // ReferrerLog oluştur
              const referrer: ReferrerLog = {
                referrerUrl,
                sourceDomain: expectedDomain,
                sourceType,
              };

              // Log kaydı oluştur
              const log = await logReferrer(visitorInfo, referrer);
              createdLogIds.push(log.id);

              // Property: Details içinde source domain bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as ReferrerTrackDetails;
              expect(details.sourceDomain).toBeDefined();
              expect(details.sourceDomain).toBe(expectedDomain);

              // Property: Domain boş olmamalı (geçerli URL için)
              expect(details.sourceDomain.length).toBeGreaterThan(0);

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
   * Property 10.3: Sosyal Medya Referrer'ları Doğru Sınıflandırılmalı
   * 
   * *For any* social media referrer, the source type SHALL be 'social'.
   * 
   * **Validates: Requirements 9.4**
   */
  it(
    'Property 10.3: Sosyal medya referrer\'ları "social" olarak sınıflandırılmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            socialMediaReferrerArbitrary,
            validIPv4Arbitrary,
            userAgentArbitrary,
            sessionIdArbitrary,
            async (referrerUrl, ipAddress, userAgent, sessionId) => {
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

              // Visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id,
                sessionId,
                userAgent,
                referrer: referrerUrl,
              };

              // Domain ve source type'ı hesapla
              const sourceDomain = extractDomain(referrerUrl);
              const sourceType = classifySourceType(referrerUrl);

              // ReferrerLog oluştur
              const referrer: ReferrerLog = {
                referrerUrl,
                sourceDomain,
                sourceType,
              };

              // Log kaydı oluştur
              const log = await logReferrer(visitorInfo, referrer);
              createdLogIds.push(log.id);

              // Property: Source type 'social' olmalı
              expect(log.details).toBeDefined();
              const details = log.details as ReferrerTrackDetails;
              expect(details.sourceType).toBe('social');

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
   * Property 10.4: Arama Motoru Referrer'ları Doğru Sınıflandırılmalı
   * 
   * *For any* search engine referrer, the source type SHALL be 'search'.
   * 
   * **Validates: Requirements 9.4**
   */
  it(
    'Property 10.4: Arama motoru referrer\'ları "search" olarak sınıflandırılmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchEngineReferrerArbitrary,
            validIPv4Arbitrary,
            userAgentArbitrary,
            sessionIdArbitrary,
            async (referrerUrl, ipAddress, userAgent, sessionId) => {
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

              // Visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id,
                sessionId,
                userAgent,
                referrer: referrerUrl,
              };

              // Domain ve source type'ı hesapla
              const sourceDomain = extractDomain(referrerUrl);
              const sourceType = classifySourceType(referrerUrl);

              // ReferrerLog oluştur
              const referrer: ReferrerLog = {
                referrerUrl,
                sourceDomain,
                sourceType,
              };

              // Log kaydı oluştur
              const log = await logReferrer(visitorInfo, referrer);
              createdLogIds.push(log.id);

              // Property: Source type 'search' olmalı
              expect(log.details).toBeDefined();
              const details = log.details as ReferrerTrackDetails;
              expect(details.sourceType).toBe('search');

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
   * Property 10.5: Diğer Referrer'lar Doğru Sınıflandırılmalı
   * 
   * *For any* other external referrer (not social or search), the source type SHALL be 'other'.
   * 
   * **Validates: Requirements 9.4**
   */
  it(
    'Property 10.5: Diğer referrer\'lar "other" olarak sınıflandırılmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            otherReferrerArbitrary,
            validIPv4Arbitrary,
            userAgentArbitrary,
            sessionIdArbitrary,
            async (referrerUrl, ipAddress, userAgent, sessionId) => {
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

              // Visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id,
                sessionId,
                userAgent,
                referrer: referrerUrl,
              };

              // Domain ve source type'ı hesapla
              const sourceDomain = extractDomain(referrerUrl);
              const sourceType = classifySourceType(referrerUrl);

              // ReferrerLog oluştur
              const referrer: ReferrerLog = {
                referrerUrl,
                sourceDomain,
                sourceType,
              };

              // Log kaydı oluştur
              const log = await logReferrer(visitorInfo, referrer);
              createdLogIds.push(log.id);

              // Property: Source type 'other' olmalı
              expect(log.details).toBeDefined();
              const details = log.details as ReferrerTrackDetails;
              expect(details.sourceType).toBe('other');

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
   * Property 10.6: Source Counter Artırılmalı
   * 
   * *For any* referrer detection, the source counter SHALL be incremented.
   * 
   * **Validates: Requirements 9.5**
   */
  it(
    'Property 10.6: Referrer tespit edildiğinde source counter artırılmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            externalReferrerArbitrary,
            validIPv4Arbitrary,
            userAgentArbitrary,
            sessionIdArbitrary,
            async (referrerUrl, ipAddress, userAgent, sessionId) => {
              // Source counter'ları sıfırla (her test için temiz başla)
              resetSourceCounters();

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

              // Visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id,
                sessionId,
                userAgent,
                referrer: referrerUrl,
              };

              // Domain ve source type'ı hesapla
              const sourceDomain = extractDomain(referrerUrl);
              const sourceType = classifySourceType(referrerUrl);

              // Önceki counter değerini al
              const previousCount = getSourceCounter(sourceDomain);

              // ReferrerLog oluştur
              const referrer: ReferrerLog = {
                referrerUrl,
                sourceDomain,
                sourceType,
              };

              // Log kaydı oluştur
              const log = await logReferrer(visitorInfo, referrer);
              createdLogIds.push(log.id);

              // Property: Details içinde sourceCount bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as ReferrerTrackDetails;
              expect(details.sourceCount).toBeDefined();

              // Property: Counter artmış olmalı
              expect(details.sourceCount).toBe(previousCount + 1);

              // Property: Global counter da artmış olmalı
              const currentCount = getSourceCounter(sourceDomain);
              expect(currentCount).toBe(previousCount + 1);

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
   * Property 10.7: Aynı Domain için Counter Kümülatif Artmalı
   * 
   * *For any* sequence of referrers from the same domain, the counter SHALL increment cumulatively.
   * 
   * **Validates: Requirements 9.5**
   */
  it(
    'Property 10.7: Aynı domain için counter kümülatif artmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        // Source counter'ları sıfırla
        resetSourceCounters();

        // Sabit bir domain kullan
        const testDomain = 'facebook.com';
        const testReferrerUrl = 'https://www.facebook.com/share';

        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 5 }),
            validIPv4Arbitrary,
            userAgentArbitrary,
            async (iterationCount, ipAddress, userAgent) => {
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

              // Başlangıç counter değeri
              const startCount = getSourceCounter(testDomain);

              // Birden fazla log oluştur
              for (let i = 0; i < iterationCount; i++) {
                const visitorInfo: VisitorInfo = {
                  ipAddress,
                  userId: user.id,
                  sessionId: null,
                  userAgent,
                  referrer: testReferrerUrl,
                };

                const referrer: ReferrerLog = {
                  referrerUrl: testReferrerUrl,
                  sourceDomain: testDomain,
                  sourceType: 'social',
                };

                const log = await logReferrer(visitorInfo, referrer);
                createdLogIds.push(log.id);

                // Her iterasyonda counter artmalı
                const details = log.details as ReferrerTrackDetails;
                expect(details.sourceCount).toBe(startCount + i + 1);
              }

              // Final counter değeri doğru olmalı
              const finalCount = getSourceCounter(testDomain);
              expect(finalCount).toBe(startCount + iterationCount);

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


// ============================================================================
// Unit-style Property Tests for Helper Functions
// ============================================================================

describe('Property Tests: Referrer Helper Functions', () => {
  /**
   * Property: extractDomain geçerli URL'lerden domain çıkarmalı
   */
  it('extractDomain geçerli URL\'lerden domain çıkarmalı', () => {
    fc.assert(
      fc.property(randomUrlArbitrary, (url) => {
        const domain = extractDomain(url);
        // Domain boş olmamalı
        return domain.length > 0;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: extractDomain www prefix'ini kaldırmalı
   */
  it('extractDomain www prefix\'ini kaldırmalı', () => {
    fc.assert(
      fc.property(randomDomainArbitrary, (domain) => {
        const urlWithWww = `https://www.${domain}/page`;
        const extracted = extractDomain(urlWithWww);
        // www. kaldırılmış olmalı
        return extracted === domain;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: classifySourceType sosyal medya domain'lerini doğru sınıflandırmalı
   */
  it('classifySourceType sosyal medya domain\'lerini "social" olarak sınıflandırmalı', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SOCIAL_MEDIA_DOMAINS),
        (domain) => {
          const url = `https://${domain}/page`;
          return classifySourceType(url) === 'social';
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: classifySourceType arama motoru domain'lerini doğru sınıflandırmalı
   */
  it('classifySourceType arama motoru domain\'lerini "search" olarak sınıflandırmalı', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SEARCH_ENGINE_DOMAINS),
        (domain) => {
          const url = `https://${domain}/search`;
          return classifySourceType(url) === 'search';
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: classifySourceType boş referrer'ı direct olarak sınıflandırmalı
   */
  it('classifySourceType boş referrer\'ı "direct" olarak sınıflandırmalı', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', null as unknown as string, undefined as unknown as string),
        (referrer) => {
          return classifySourceType(referrer) === 'direct';
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: incrementSourceCounter her çağrıda artmalı
   */
  it('incrementSourceCounter her çağrıda counter\'ı artırmalı', () => {
    fc.assert(
      fc.property(
        randomDomainArbitrary,
        fc.integer({ min: 1, max: 10 }),
        (domain, times) => {
          // Önce sıfırla
          resetSourceCounters();
          
          let lastCount = 0;
          for (let i = 0; i < times; i++) {
            const newCount = incrementSourceCounter(domain);
            // Her seferinde artmalı
            if (newCount !== lastCount + 1) {
              return false;
            }
            lastCount = newCount;
          }
          
          // Final değer doğru olmalı
          return getSourceCounter(domain) === times;
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ============================================================================
// Integration Property Tests - logReferrerFromUrl
// ============================================================================

describe('Property Tests: logReferrerFromUrl Integration', () => {
  /**
   * Property: logReferrerFromUrl URL'den otomatik domain ve type çıkarmalı
   */
  it(
    'logReferrerFromUrl URL\'den otomatik domain ve type çıkarmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            externalReferrerArbitrary,
            validIPv4Arbitrary,
            userAgentArbitrary,
            async (referrerUrl, ipAddress, userAgent) => {
              // Source counter'ları sıfırla
              resetSourceCounters();

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

              // Visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id,
                sessionId: null,
                userAgent,
                referrer: referrerUrl,
              };

              // Beklenen değerleri hesapla
              const expectedDomain = extractDomain(referrerUrl);
              const expectedType = classifySourceType(referrerUrl);

              // logReferrerFromUrl kullan
              const log = await logReferrerFromUrl(visitorInfo, referrerUrl);
              createdLogIds.push(log.id);

              // Property: Tüm alanlar doğru olmalı
              expect(log.details).toBeDefined();
              const details = log.details as ReferrerTrackDetails;
              expect(details.referrerUrl).toBe(referrerUrl);
              expect(details.sourceDomain).toBe(expectedDomain);
              expect(details.sourceType).toBe(expectedType);
              expect(details.sourceCount).toBe(1);

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
