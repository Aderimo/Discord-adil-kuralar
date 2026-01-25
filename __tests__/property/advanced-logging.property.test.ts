/**
 * Advanced Logging Property-Based Tests
 * 
 * Feature: gelismis-loglama, Property 1: IP ve Kullanıcı Bilgisi Loglama
 * 
 * Bu test dosyası, ziyaretçi erişim loglamasının doğruluğunu property-based testing
 * ile doğrular. Tüm ziyaretçiler (anonim veya authenticated) için log kaydının
 * geçerli IP adresi ve uygun kullanıcı tanımlayıcısı içerdiğini test eder.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import {
  logVisitorAccess,
  isValidIPv4,
  isValidIPv6,
  isValidIP,
  normalizeIP,
  DEFAULT_IP_ADDRESS,
  ANONYMOUS_USER_ID,
  type VisitorInfo,
  type VisitorAccessDetails,
} from '@/lib/advanced-logging';
import { hashPassword } from '@/lib/auth';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = `adv_${Date.now().toString(36)}`;

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Test loglarını temizle
  await prisma.activityLog.deleteMany({
    where: {
      action: 'visitor_access',
      details: {
        contains: testRunId,
      },
    },
  });
  // Test kullanıcılarını temizle (sistem kullanıcısı hariç)
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
 * Geçerli IPv4 adresi oluşturan arbitrary
 * Format: X.X.X.X where X is 0-255
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
 * Geçerli IPv6 adresi oluşturan arbitrary
 * Simplified full format: XXXX:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX
 */
const validIPv6Arbitrary = fc
  .array(fc.hexaString({ minLength: 1, maxLength: 4 }), { minLength: 8, maxLength: 8 })
  .map((parts) => parts.join(':'));

/**
 * Geçersiz IP adresi oluşturan arbitrary
 * Çeşitli geçersiz formatlar
 */
const invalidIPArbitrary = fc.oneof(
  // Boş string
  fc.constant(''),
  // Sadece metin
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 10 }),
  // Eksik segment
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([a, b]) => `${a}.${b}`),
  // Fazla segment
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([a, b, c, d, e]) => `${a}.${b}.${c}.${d}.${e}`),
  // Geçersiz değerler (256+)
  fc.tuple(
    fc.integer({ min: 256, max: 999 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
  // Özel karakterler
  fc.constant('192.168.1.1/24'),
  fc.constant('192.168.1.1:8080'),
  fc.constant('localhost'),
  fc.constant('::ffff:192.168.1.1.extra')
);

/**
 * Geçerli kullanıcı ID'si oluşturan arbitrary (authenticated user)
 */
const validUserIdArbitrary = fc
  .tuple(
    fc.integer({ min: 1, max: 99999 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
      minLength: 4,
      maxLength: 8,
    })
  )
  .map(([num, str]) => `user_${testRunId}_${num}_${str}`);

/**
 * User agent string oluşturan arbitrary
 */
const userAgentArbitrary = fc.constantFrom(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  'curl/7.68.0',
  ''
);

/**
 * Referrer URL oluşturan arbitrary
 */
const referrerArbitrary = fc.oneof(
  fc.constant(null),
  fc.constantFrom(
    'https://google.com/search?q=yetkili+kilavuzu',
    'https://discord.com/channels/123456789',
    'https://twitter.com/status/123456789',
    'https://example.com/page',
    ''
  )
);

/**
 * Session ID oluşturan arbitrary
 */
const sessionIdArbitrary = fc.oneof(
  fc.constant(null),
  fc.uuid()
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: IP ve Kullanıcı Bilgisi Loglama (Property 1)', () => {
  /**
   * Property 1.1: Geçerli IPv4 Adresleri Doğru Loglanmalı
   * 
   * *For any* valid IPv4 address, the log entry SHALL contain that exact IP address.
   * 
   * **Validates: Requirements 1.1, 1.4**
   */
  it(
    'Property 1.1: Geçerli IPv4 adresleri log kaydında korunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPv4Arbitrary,
            userAgentArbitrary,
            referrerArbitrary,
            sessionIdArbitrary,
            async (ipAddress, userAgent, referrer, sessionId) => {
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
                referrer,
              };

              // Log kaydı oluştur
              const log = await logVisitorAccess(visitorInfo);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: IP adresi korunmuş olmalı
              expect(log.ipAddress).toBe(ipAddress);

              // Property: IP adresi geçerli IPv4 formatında olmalı
              expect(isValidIPv4(log.ipAddress)).toBe(true);

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
   * Property 1.2: Geçerli IPv6 Adresleri Doğru Loglanmalı
   * 
   * *For any* valid IPv6 address, the log entry SHALL contain that exact IP address.
   * 
   * **Validates: Requirements 1.1, 1.4**
   */
  it(
    'Property 1.2: Geçerli IPv6 adresleri log kaydında korunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPv6Arbitrary,
            userAgentArbitrary,
            referrerArbitrary,
            sessionIdArbitrary,
            async (ipAddress, userAgent, referrer, sessionId) => {
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
                referrer,
              };

              // Log kaydı oluştur
              const log = await logVisitorAccess(visitorInfo);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: IP adresi korunmuş olmalı
              expect(log.ipAddress).toBe(ipAddress);

              // Property: IP adresi geçerli IPv6 formatında olmalı
              expect(isValidIPv6(log.ipAddress)).toBe(true);

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
   * Property 1.3: Geçersiz IP Adresleri Varsayılan IP ile Loglanmalı
   * 
   * *For any* invalid IP address, the log entry SHALL contain the default IP (0.0.0.0).
   * 
   * **Validates: Requirements 1.4 (Error Handling)**
   */
  it(
    'Property 1.3: Geçersiz IP adresleri varsayılan IP (0.0.0.0) ile loglanmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            invalidIPArbitrary,
            userAgentArbitrary,
            referrerArbitrary,
            sessionIdArbitrary,
            async (ipAddress, userAgent, referrer, sessionId) => {
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
                referrer,
              };

              // Log kaydı oluştur
              const log = await logVisitorAccess(visitorInfo);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Geçersiz IP için varsayılan IP kullanılmalı
              expect(log.ipAddress).toBe(DEFAULT_IP_ADDRESS);

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
   * Property 1.4: Anonim Ziyaretçiler için isAnonymous True Olmalı
   * 
   * *For any* anonymous visitor (userId = null), the log entry SHALL have isAnonymous = true.
   * 
   * **Validates: Requirements 1.2**
   */
  it(
    'Property 1.4: Anonim ziyaretçiler için isAnonymous true olmalı',
    async () => {
      const createdLogIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPv4Arbitrary,
            userAgentArbitrary,
            referrerArbitrary,
            sessionIdArbitrary,
            async (ipAddress, userAgent, referrer, sessionId) => {
              // Anonim visitor info oluştur (userId = null)
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: null, // Anonim kullanıcı
                sessionId,
                userAgent,
                referrer,
              };

              // Log kaydı oluştur
              const log = await logVisitorAccess(visitorInfo);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde isAnonymous true olmalı
              expect(log.details).toBeDefined();
              const details = log.details as VisitorAccessDetails;
              expect(details.isAnonymous).toBe(true);

              // Property: Action visitor_access olmalı
              expect(log.action).toBe('visitor_access');

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
      }
    },
    60000
  );

  /**
   * Property 1.5: Authenticated Kullanıcılar için isAnonymous False ve userId Eşleşmeli
   * 
   * *For any* authenticated visitor (userId != null), the log entry SHALL have 
   * isAnonymous = false and userId matching the provided user ID.
   * 
   * **Validates: Requirements 1.3**
   */
  it(
    'Property 1.5: Authenticated kullanıcılar için isAnonymous false ve userId eşleşmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPv4Arbitrary,
            userAgentArbitrary,
            referrerArbitrary,
            sessionIdArbitrary,
            async (ipAddress, userAgent, referrer, sessionId) => {
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

              // Authenticated visitor info oluştur
              const visitorInfo: VisitorInfo = {
                ipAddress,
                userId: user.id, // Authenticated kullanıcı
                sessionId,
                userAgent,
                referrer,
              };

              // Log kaydı oluştur
              const log = await logVisitorAccess(visitorInfo);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde isAnonymous false olmalı
              expect(log.details).toBeDefined();
              const details = log.details as VisitorAccessDetails;
              expect(details.isAnonymous).toBe(false);

              // Property: userId eşleşmeli
              expect(log.userId).toBe(user.id);

              // Property: Action visitor_access olmalı
              expect(log.action).toBe('visitor_access');

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
// Unit-style Property Tests for IP Validation Functions
// ============================================================================

describe('Property Tests: IP Validation Functions', () => {
  /**
   * Property: isValidIPv4 doğru çalışmalı
   */
  it('isValidIPv4 geçerli IPv4 adresleri için true döndürmeli', () => {
    fc.assert(
      fc.property(validIPv4Arbitrary, (ip) => {
        return isValidIPv4(ip) === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: isValidIPv6 doğru çalışmalı
   */
  it('isValidIPv6 geçerli IPv6 adresleri için true döndürmeli', () => {
    fc.assert(
      fc.property(validIPv6Arbitrary, (ip) => {
        return isValidIPv6(ip) === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: isValidIP geçerli IP'ler için true döndürmeli
   */
  it('isValidIP geçerli IPv4 veya IPv6 adresleri için true döndürmeli', () => {
    fc.assert(
      fc.property(
        fc.oneof(validIPv4Arbitrary, validIPv6Arbitrary),
        (ip) => {
          return isValidIP(ip) === true;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: normalizeIP geçerli IP'leri korumalı
   */
  it('normalizeIP geçerli IP adreslerini değiştirmemeli', () => {
    fc.assert(
      fc.property(
        fc.oneof(validIPv4Arbitrary, validIPv6Arbitrary),
        (ip) => {
          return normalizeIP(ip) === ip;
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: normalizeIP geçersiz IP'ler için varsayılan döndürmeli
   */
  it('normalizeIP geçersiz IP adresleri için varsayılan IP döndürmeli', () => {
    fc.assert(
      fc.property(invalidIPArbitrary, (ip) => {
        return normalizeIP(ip) === DEFAULT_IP_ADDRESS;
      }),
      { numRuns: 5 }
    );
  });
});


// ============================================================================
// Property 2: AI Etkileşim Loglama
// Feature: gelismis-loglama, Property 2: AI Etkileşim Loglama
// **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
// ============================================================================

// Arbitraries for AI Interaction Tests

/**
 * AI soru metni oluşturan arbitrary
 * Çeşitli uzunluklarda sorular
 */
const aiQuestionArbitrary = fc.oneof(
  // Kısa sorular
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ?!.,'), {
    minLength: 5,
    maxLength: 100,
  }),
  // Orta uzunlukta sorular
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ?!.,'), {
    minLength: 100,
    maxLength: 500,
  }),
  // Uzun sorular (truncation test için)
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ?!.,'), {
    minLength: 1500,
    maxLength: 2500,
  })
);

/**
 * AI cevap metni oluşturan arbitrary
 * Çeşitli uzunluklarda cevaplar
 */
const aiResponseArbitrary = fc.oneof(
  // Kısa cevaplar
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'), {
    minLength: 10,
    maxLength: 200,
  }),
  // Orta uzunlukta cevaplar
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'), {
    minLength: 200,
    maxLength: 1000,
  }),
  // Uzun cevaplar (truncation test için)
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'), {
    minLength: 1500,
    maxLength: 3000,
  })
);

/**
 * AI confidence seviyesi arbitrary
 */
const confidenceArbitrary = fc.constantFrom<'high' | 'medium' | 'low'>('high', 'medium', 'low');

/**
 * Response time (ms) arbitrary
 */
const responseTimeArbitrary = fc.integer({ min: 50, max: 30000 });

// Import AI interaction logging function
import {
  logAIInteraction,
  truncateAIText,
  AI_TEXT_MAX_LENGTH,
  type AIInteractionLog,
  type AIInteractionDetails,
} from '@/lib/advanced-logging';

describe('Property Tests: AI Etkileşim Loglama (Property 2)', () => {
  /**
   * Property 2.1: AI Etkileşiminde Soru Metni Kaydedilmeli
   * 
   * *For any* AI interaction, the log entry SHALL contain the question text.
   * 
   * **Validates: Requirements 2.1**
   */
  it(
    'Property 2.1: AI etkileşiminde soru metni kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            aiQuestionArbitrary,
            aiResponseArbitrary,
            confidenceArbitrary,
            responseTimeArbitrary,
            validIPv4Arbitrary,
            async (question, response, confidence, responseTime, ipAddress) => {
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

              // AI etkileşim bilgisi oluştur
              const interaction: AIInteractionLog = {
                question,
                response,
                confidence,
                responseTime,
              };

              // Log kaydı oluştur
              const log = await logAIInteraction(user.id, interaction, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde soru metni bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as AIInteractionDetails;
              expect(details.question).toBeDefined();
              
              // Property: Soru metni boş olmamalı (orijinal soru boş değilse)
              if (question.length > 0) {
                expect(details.question.length).toBeGreaterThan(0);
              }

              // Property: Soru metni orijinal metnin başlangıcını içermeli
              const expectedQuestion = question.length > AI_TEXT_MAX_LENGTH 
                ? question.substring(0, AI_TEXT_MAX_LENGTH) 
                : question;
              expect(details.question).toBe(expectedQuestion);

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
   * Property 2.2: AI Etkileşiminde Cevap Metni Kaydedilmeli
   * 
   * *For any* AI interaction, the log entry SHALL contain the response text.
   * 
   * **Validates: Requirements 2.2**
   */
  it(
    'Property 2.2: AI etkileşiminde cevap metni kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            aiQuestionArbitrary,
            aiResponseArbitrary,
            confidenceArbitrary,
            responseTimeArbitrary,
            validIPv4Arbitrary,
            async (question, response, confidence, responseTime, ipAddress) => {
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

              // AI etkileşim bilgisi oluştur
              const interaction: AIInteractionLog = {
                question,
                response,
                confidence,
                responseTime,
              };

              // Log kaydı oluştur
              const log = await logAIInteraction(user.id, interaction, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde cevap metni bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as AIInteractionDetails;
              expect(details.response).toBeDefined();
              
              // Property: Cevap metni boş olmamalı (orijinal cevap boş değilse)
              if (response.length > 0) {
                expect(details.response.length).toBeGreaterThan(0);
              }

              // Property: Cevap metni orijinal metnin başlangıcını içermeli
              const expectedResponse = response.length > AI_TEXT_MAX_LENGTH 
                ? response.substring(0, AI_TEXT_MAX_LENGTH) 
                : response;
              expect(details.response).toBe(expectedResponse);

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
   * Property 2.3: Soru ve Cevap Tek Bir Log Kaydında Birlikte Olmalı
   * 
   * *For any* AI interaction, the question and response SHALL be linked in a single log entry.
   * 
   * **Validates: Requirements 2.3**
   */
  it(
    'Property 2.3: Soru ve cevap tek bir log kaydında birlikte olmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            aiQuestionArbitrary,
            aiResponseArbitrary,
            confidenceArbitrary,
            responseTimeArbitrary,
            validIPv4Arbitrary,
            async (question, response, confidence, responseTime, ipAddress) => {
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

              // AI etkileşim bilgisi oluştur
              const interaction: AIInteractionLog = {
                question,
                response,
                confidence,
                responseTime,
              };

              // Log kaydı oluştur
              const log = await logAIInteraction(user.id, interaction, ipAddress);
              createdLogIds.push(log.id);

              // Property: Tek bir log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde hem soru hem cevap bulunmalı (aynı kayıtta)
              expect(log.details).toBeDefined();
              const details = log.details as AIInteractionDetails;
              
              // Property: Soru ve cevap aynı details objesinde
              expect(details.question).toBeDefined();
              expect(details.response).toBeDefined();
              
              // Property: Event tipi ai_interaction olmalı
              expect(details.event).toBe('ai_interaction');
              
              // Property: Action ai_interaction olmalı
              expect(log.action).toBe('ai_interaction');

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
   * Property 2.4: Timestamp ve User ID Log Kaydında Bulunmalı
   * 
   * *For any* AI interaction, the log entry SHALL include timestamp and user identifier.
   * 
   * **Validates: Requirements 2.5**
   */
  it(
    'Property 2.4: Timestamp ve userId log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            aiQuestionArbitrary,
            aiResponseArbitrary,
            confidenceArbitrary,
            responseTimeArbitrary,
            validIPv4Arbitrary,
            async (question, response, confidence, responseTime, ipAddress) => {
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

              // AI etkileşim bilgisi oluştur
              const interaction: AIInteractionLog = {
                question,
                response,
                confidence,
                responseTime,
              };

              // Log kaydı oluştur
              const log = await logAIInteraction(user.id, interaction, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: userId log kaydında bulunmalı
              expect(log.userId).toBeDefined();
              expect(log.userId).toBe(user.id);

              // Property: Details içinde timestamp bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as AIInteractionDetails;
              expect(details.timestamp).toBeDefined();
              
              // Property: Timestamp geçerli ISO format olmalı
              const timestampDate = new Date(details.timestamp);
              expect(timestampDate.toString()).not.toBe('Invalid Date');
              
              // Property: Timestamp şu anki zamana yakın olmalı (5 saniye içinde)
              const now = new Date();
              const timeDiff = Math.abs(now.getTime() - timestampDate.getTime());
              expect(timeDiff).toBeLessThan(5000);

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
   * Property 2.5: 2000 Karakterden Uzun Metinler Truncate Edilmeli
   * 
   * *For any* text exceeding 2000 characters, the logged text SHALL be truncated to exactly 2000 characters.
   * 
   * **Validates: Requirements 2.4**
   */
  it(
    'Property 2.5: 2000 karakterden uzun metinler truncate edilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      // Uzun metin oluşturan arbitrary (2000+ karakter)
      const longTextArbitrary = fc.stringOf(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;'),
        { minLength: 2001, maxLength: 5000 }
      );

      try {
        await fc.assert(
          fc.asyncProperty(
            longTextArbitrary,
            longTextArbitrary,
            confidenceArbitrary,
            responseTimeArbitrary,
            validIPv4Arbitrary,
            async (question, response, confidence, responseTime, ipAddress) => {
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

              // AI etkileşim bilgisi oluştur (uzun metinlerle)
              const interaction: AIInteractionLog = {
                question,
                response,
                confidence,
                responseTime,
              };

              // Log kaydı oluştur
              const log = await logAIInteraction(user.id, interaction, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde truncate edilmiş metinler bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as AIInteractionDetails;
              
              // Property: Soru metni tam olarak 2000 karakter olmalı
              expect(details.question.length).toBe(AI_TEXT_MAX_LENGTH);
              
              // Property: Cevap metni tam olarak 2000 karakter olmalı
              expect(details.response.length).toBe(AI_TEXT_MAX_LENGTH);
              
              // Property: Truncate edilmiş metin orijinalin başlangıcı olmalı
              expect(details.question).toBe(question.substring(0, AI_TEXT_MAX_LENGTH));
              expect(details.response).toBe(response.substring(0, AI_TEXT_MAX_LENGTH));

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
// Unit-style Property Tests for AI Text Truncation
// ============================================================================

describe('Property Tests: AI Text Truncation Functions', () => {
  /**
   * Property: truncateAIText 2000 karakterden kısa metinleri değiştirmemeli
   */
  it('truncateAIText 2000 karakterden kısa metinleri değiştirmemeli', () => {
    const shortTextArbitrary = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '),
      { minLength: 0, maxLength: 2000 }
    );

    fc.assert(
      fc.property(shortTextArbitrary, (text) => {
        const result = truncateAIText(text);
        return result === text;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: truncateAIText 2000 karakterden uzun metinleri tam olarak 2000 karaktere kısaltmalı
   */
  it('truncateAIText 2000 karakterden uzun metinleri tam olarak 2000 karaktere kısaltmalı', () => {
    const longTextArbitrary = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '),
      { minLength: 2001, maxLength: 10000 }
    );

    fc.assert(
      fc.property(longTextArbitrary, (text) => {
        const result = truncateAIText(text);
        return result.length === AI_TEXT_MAX_LENGTH && text.startsWith(result);
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: truncateAIText boş string için boş string döndürmeli
   */
  it('truncateAIText boş string için boş string döndürmeli', () => {
    expect(truncateAIText('')).toBe('');
  });
});


// ============================================================================
// Property 4: Sayfa Erişim Loglama
// Feature: gelismis-loglama, Property 4: Sayfa Erişim Loglama
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
// ============================================================================

// Import Page Access logging function
import {
  logPageAccess,
  type PageAccessLog,
  type PageAccessDetails,
} from '@/lib/advanced-logging';

// Arbitraries for Page Access Tests

/**
 * Sayfa URL'si oluşturan arbitrary
 * Çeşitli URL formatları
 */
const pageUrlArbitrary = fc.oneof(
  // Ana sayfa
  fc.constant('/'),
  // Basit sayfalar
  fc.constantFrom('/guide', '/penalties', '/procedures', '/commands', '/admin'),
  // Alt sayfalar
  fc.constantFrom(
    '/guide/introduction',
    '/penalties/traffic',
    '/procedures/arrest',
    '/commands/admin',
    '/admin/users'
  ),
  // Dinamik sayfalar
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'), { minLength: 3, maxLength: 20 })
    .map((slug) => `/guide/${slug}`),
  // Query parametreli sayfalar
  fc.tuple(
    fc.constantFrom('/search', '/guide', '/penalties'),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 2, maxLength: 10 })
  ).map(([path, query]) => `${path}?q=${query}`)
);

/**
 * Sayfa başlığı oluşturan arbitrary
 */
const pageTitleArbitrary = fc.oneof(
  fc.constant('Ana Sayfa'),
  fc.constant('Yetkili Kılavuzu'),
  fc.constantFrom(
    'Cezalar',
    'Prosedürler',
    'Komutlar',
    'Admin Paneli',
    'Kullanıcı Yönetimi',
    'Arama Sonuçları'
  ),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '), {
    minLength: 5,
    maxLength: 50,
  })
);

/**
 * Sayfa kategorisi oluşturan arbitrary
 */
const pageCategoryArbitrary = fc.constantFrom(
  'guide',
  'penalties',
  'procedures',
  'commands',
  'admin',
  'search',
  'home',
  'auth',
  'other'
);

/**
 * İçerik türü oluşturan arbitrary
 */
const contentTypeArbitrary = fc.constantFrom(
  'page',
  'article',
  'list',
  'form',
  'dashboard',
  'search-results',
  'detail',
  'index'
);

/**
 * Referrer URL oluşturan arbitrary (sayfa erişimi için)
 */
const pageReferrerArbitrary = fc.oneof(
  // Referrer yok (direct access)
  fc.constant(null),
  // İç sayfalardan navigasyon
  fc.constantFrom(
    '/guide',
    '/penalties',
    '/procedures',
    '/commands',
    '/',
    '/admin'
  ),
  // Dış sitelerden erişim
  fc.constantFrom(
    'https://google.com/search?q=yetkili+kilavuzu',
    'https://discord.com/channels/123456789',
    'https://twitter.com/status/123456789',
    'https://example.com/page',
    'https://facebook.com/share'
  )
);

/**
 * Erişim türü oluşturan arbitrary
 */
const accessTypeArbitrary = fc.constantFrom<'direct' | 'navigation' | 'external'>(
  'direct',
  'navigation',
  'external'
);

describe('Property Tests: Sayfa Erişim Loglama (Property 4)', () => {
  /**
   * Property 4.1: Sayfa Erişiminde URL Kaydedilmeli
   * 
   * *For any* page access, the log entry SHALL contain the page URL.
   * 
   * **Validates: Requirements 3.1**
   */
  it(
    'Property 4.1: Sayfa erişiminde URL kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            pageUrlArbitrary,
            pageTitleArbitrary,
            pageCategoryArbitrary,
            contentTypeArbitrary,
            pageReferrerArbitrary,
            accessTypeArbitrary,
            validIPv4Arbitrary,
            async (url, title, category, contentType, referrerUrl, accessType, ipAddress) => {
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

              // Sayfa erişim bilgisi oluştur
              const access: PageAccessLog = {
                url,
                title,
                category,
                contentType,
                referrerUrl,
                accessType,
              };

              // Log kaydı oluştur
              const log = await logPageAccess(user.id, access, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde URL bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as PageAccessDetails;
              expect(details.url).toBeDefined();
              expect(details.url).toBe(url);

              // Property: Action page_access olmalı
              expect(log.action).toBe('page_access');

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
   * Property 4.2: Sayfa Erişiminde Title, Category ve ContentType Kaydedilmeli
   * 
   * *For any* page access, the log entry SHALL contain page title, category, and content type.
   * 
   * **Validates: Requirements 3.2**
   */
  it(
    'Property 4.2: Sayfa erişiminde title, category ve contentType kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            pageUrlArbitrary,
            pageTitleArbitrary,
            pageCategoryArbitrary,
            contentTypeArbitrary,
            pageReferrerArbitrary,
            accessTypeArbitrary,
            validIPv4Arbitrary,
            async (url, title, category, contentType, referrerUrl, accessType, ipAddress) => {
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

              // Sayfa erişim bilgisi oluştur
              const access: PageAccessLog = {
                url,
                title,
                category,
                contentType,
                referrerUrl,
                accessType,
              };

              // Log kaydı oluştur
              const log = await logPageAccess(user.id, access, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde title, category ve contentType bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as PageAccessDetails;
              
              // Property: Title kaydedilmiş olmalı
              expect(details.title).toBeDefined();
              expect(details.title).toBe(title);
              
              // Property: Category kaydedilmiş olmalı
              expect(details.category).toBeDefined();
              expect(details.category).toBe(category);
              
              // Property: ContentType kaydedilmiş olmalı
              expect(details.contentType).toBeDefined();
              expect(details.contentType).toBe(contentType);

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
   * Property 4.3: Referrer URL Varsa Kaydedilmeli
   * 
   * *For any* page access with referrer, the referrer URL SHALL be recorded.
   * 
   * **Validates: Requirements 3.3**
   */
  it(
    'Property 4.3: Referrer URL varsa kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      // Sadece referrer olan durumları test et
      const nonNullReferrerArbitrary = fc.constantFrom(
        '/guide',
        '/penalties',
        '/procedures',
        'https://google.com/search?q=yetkili+kilavuzu',
        'https://discord.com/channels/123456789',
        'https://twitter.com/status/123456789'
      );

      try {
        await fc.assert(
          fc.asyncProperty(
            pageUrlArbitrary,
            pageTitleArbitrary,
            pageCategoryArbitrary,
            contentTypeArbitrary,
            nonNullReferrerArbitrary,
            accessTypeArbitrary,
            validIPv4Arbitrary,
            async (url, title, category, contentType, referrerUrl, accessType, ipAddress) => {
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

              // Sayfa erişim bilgisi oluştur (referrer ile)
              const access: PageAccessLog = {
                url,
                title,
                category,
                contentType,
                referrerUrl,
                accessType,
              };

              // Log kaydı oluştur
              const log = await logPageAccess(user.id, access, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde referrerUrl bulunmalı ve değeri doğru olmalı
              expect(log.details).toBeDefined();
              const details = log.details as PageAccessDetails;
              expect(details.referrerUrl).toBeDefined();
              expect(details.referrerUrl).toBe(referrerUrl);

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
   * Property 4.4: Referrer Yoksa null Olarak Kaydedilmeli
   * 
   * *For any* page access without referrer, the referrerUrl SHALL be null.
   * 
   * **Validates: Requirements 3.3**
   */
  it(
    'Property 4.4: Referrer yoksa null olarak kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            pageUrlArbitrary,
            pageTitleArbitrary,
            pageCategoryArbitrary,
            contentTypeArbitrary,
            accessTypeArbitrary,
            validIPv4Arbitrary,
            async (url, title, category, contentType, accessType, ipAddress) => {
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

              // Sayfa erişim bilgisi oluştur (referrer olmadan)
              const access: PageAccessLog = {
                url,
                title,
                category,
                contentType,
                referrerUrl: null, // Referrer yok
                accessType,
              };

              // Log kaydı oluştur
              const log = await logPageAccess(user.id, access, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde referrerUrl null olmalı
              expect(log.details).toBeDefined();
              const details = log.details as PageAccessDetails;
              expect(details.referrerUrl).toBeNull();

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
   * Property 4.5: Erişim Türü Doğru Sınıflandırılmalı
   * 
   * *For any* page access, the accessType SHALL be correctly classified (direct/navigation/external).
   * 
   * **Validates: Requirements 3.4**
   */
  it(
    'Property 4.5: Erişim türü doğru sınıflandırılmalı (direct/navigation/external)',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            pageUrlArbitrary,
            pageTitleArbitrary,
            pageCategoryArbitrary,
            contentTypeArbitrary,
            pageReferrerArbitrary,
            accessTypeArbitrary,
            validIPv4Arbitrary,
            async (url, title, category, contentType, referrerUrl, accessType, ipAddress) => {
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

              // Sayfa erişim bilgisi oluştur
              const access: PageAccessLog = {
                url,
                title,
                category,
                contentType,
                referrerUrl,
                accessType,
              };

              // Log kaydı oluştur
              const log = await logPageAccess(user.id, access, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde accessType bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as PageAccessDetails;
              expect(details.accessType).toBeDefined();
              
              // Property: accessType geçerli değerlerden biri olmalı
              expect(['direct', 'navigation', 'external']).toContain(details.accessType);
              
              // Property: accessType gönderilen değerle eşleşmeli
              expect(details.accessType).toBe(accessType);

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
   * Property 4.6: Tüm Sayfa Erişim Alanları Tek Bir Log Kaydında Bulunmalı
   * 
   * *For any* page navigation, the log entry SHALL contain all required fields together.
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it(
    'Property 4.6: Tüm sayfa erişim alanları tek bir log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            pageUrlArbitrary,
            pageTitleArbitrary,
            pageCategoryArbitrary,
            contentTypeArbitrary,
            pageReferrerArbitrary,
            accessTypeArbitrary,
            validIPv4Arbitrary,
            async (url, title, category, contentType, referrerUrl, accessType, ipAddress) => {
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

              // Sayfa erişim bilgisi oluştur
              const access: PageAccessLog = {
                url,
                title,
                category,
                contentType,
                referrerUrl,
                accessType,
              };

              // Log kaydı oluştur
              const log = await logPageAccess(user.id, access, ipAddress);
              createdLogIds.push(log.id);

              // Property: Tek bir log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde tüm alanlar bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as PageAccessDetails;
              
              // Property: Event tipi page_access olmalı
              expect(details.event).toBe('page_access');
              
              // Property: Tüm zorunlu alanlar mevcut olmalı
              expect(details.url).toBe(url);
              expect(details.title).toBe(title);
              expect(details.category).toBe(category);
              expect(details.contentType).toBe(contentType);
              expect(details.referrerUrl).toBe(referrerUrl);
              expect(details.accessType).toBe(accessType);
              
              // Property: Timestamp bulunmalı ve geçerli olmalı
              expect(details.timestamp).toBeDefined();
              const timestampDate = new Date(details.timestamp);
              expect(timestampDate.toString()).not.toBe('Invalid Date');

              // Property: Action page_access olmalı
              expect(log.action).toBe('page_access');

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
