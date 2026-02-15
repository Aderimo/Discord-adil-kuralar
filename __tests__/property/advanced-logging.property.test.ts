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
  // Text Input logging - Property 6
  logTextInput,
  isSensitiveField,
  SENSITIVE_FIELD_PATTERNS,
  SENSITIVE_FORM_PATTERNS,
  truncateInputText,
  INPUT_TEXT_MAX_LENGTH,
  type TextInputLog,
  type TextInputDetails,
  // Truncation functions - Property 3
  truncateText,
  truncateAIText,
  truncateCopyText,
  AI_TEXT_MAX_LENGTH,
  COPY_TEXT_MAX_LENGTH,
  // AI Interaction logging - Property 2
  logAIInteraction,
  type AIInteractionLog,
  type AIInteractionDetails,
  // Page Access logging - Property 4
  logPageAccess,
  type PageAccessLog,
  type PageAccessDetails,
  // Search Activity logging - Property 5
  logSearchActivity,
  type SearchLog,
  type SearchActivityDetails,
  // Text Copy logging - Property 12
  logTextCopy,
  type TextCopyLog,
  type TextCopyDetails,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
      { numRuns: 20 }
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
      { numRuns: 20 }
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
      { numRuns: 20 }
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
      { numRuns: 20 }
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
      { numRuns: 20 }
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
      { numRuns: 20 }
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
      { numRuns: 20 }
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
            numRuns: 20,
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
// Property 5: Arama Loglama
// Feature: gelismis-loglama, Property 5: Arama Loglama
// **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
// ============================================================================

// Import Search Activity logging function
import {
  logSearchActivity,
  type SearchLog,
  type SearchActivityDetails,
} from '@/lib/advanced-logging';

// Arbitraries for Search Activity Tests

/**
 * Arama sorgusu oluşturan arbitrary
 */
const searchQueryArbitrary = fc.oneof(
  // Kısa sorgular
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '), {
    minLength: 1,
    maxLength: 20,
  }),
  // Orta uzunlukta sorgular
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '), {
    minLength: 20,
    maxLength: 100,
  }),
  // Gerçekçi arama sorguları
  fc.constantFrom(
    'ceza',
    'prosedür',
    'komut',
    'tutuklama',
    'trafik cezası',
    'admin komutları',
    'yetkili kılavuzu',
    'nasıl yapılır'
  )
);

/**
 * Sonuç sayısı oluşturan arbitrary
 */
const resultsCountArbitrary = fc.integer({ min: 0, max: 100 });

/**
 * Seçilen sonuç oluşturan arbitrary
 */
const selectedResultArbitrary = fc.oneof(
  fc.constant(null),
  fc.constantFrom(
    '/guide/introduction',
    '/penalties/traffic',
    '/procedures/arrest',
    '/commands/admin',
    '/guide/rules'
  ),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-/'), { minLength: 5, maxLength: 50 })
);

describe('Property Tests: Arama Loglama (Property 5)', () => {
  /**
   * Property 5.1: Arama Sorgusunun Kaydedilmesi
   * 
   * *For any* search operation, the log entry SHALL contain the search query.
   * 
   * **Validates: Requirements 4.1**
   */
  it(
    'Property 5.1: Arama sorgusu kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            resultsCountArbitrary,
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde query bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.query).toBeDefined();
              expect(details.query).toBe(query);

              // Property: Action search olmalı
              expect(log.action).toBe('search');

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.2: Sonuç Sayısının Kaydedilmesi
   * 
   * *For any* search operation, the log entry SHALL include the number of results returned.
   * 
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5.2: Sonuç sayısı kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            resultsCountArbitrary,
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde resultsCount bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.resultsCount).toBeDefined();
              expect(typeof details.resultsCount).toBe('number');
              expect(details.resultsCount).toBe(resultsCount);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.3: Seçilen Sonucun Kaydedilmesi
   * 
   * *For any* search operation where user clicks on a result, the log entry SHALL record the selected result.
   * 
   * **Validates: Requirements 4.3**
   */
  it(
    'Property 5.3: Seçilen sonuç kaydedilmeli (varsa)',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      // Sadece seçilen sonuç olan durumları test et
      const nonNullSelectedResultArbitrary = fc.oneof(
        fc.constantFrom(
          '/guide/introduction',
          '/penalties/traffic',
          '/procedures/arrest',
          '/commands/admin',
          '/guide/rules'
        ),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-/'), { minLength: 5, maxLength: 50 })
      );

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            fc.integer({ min: 1, max: 100 }), // En az 1 sonuç olmalı
            nonNullSelectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur (seçilen sonuç ile)
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde selectedResult bulunmalı ve değeri doğru olmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.selectedResult).toBeDefined();
              expect(details.selectedResult).toBe(selectedResult);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.4: Sonuçsuz Aramaların Loglanması
   * 
   * *For any* search operation with zero results, the log entry SHALL be created with resultsCount = 0.
   * 
   * **Validates: Requirements 4.4**
   */
  it(
    'Property 5.4: Sonuçsuz aramalar loglanmalı (resultsCount = 0)',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            validIPv4Arbitrary,
            async (query, ipAddress) => {
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

              // Sonuçsuz arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount: 0, // Sonuç yok
                selectedResult: null, // Seçilen sonuç da yok
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı (sonuçsuz aramalar da loglanmalı)
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde resultsCount 0 olmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.resultsCount).toBe(0);
              
              // Property: selectedResult null olmalı
              expect(details.selectedResult).toBeNull();

              // Property: Query hala kaydedilmiş olmalı
              expect(details.query).toBe(query);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.5: Başarılı Aramaların Loglanması
   * 
   * *For any* search operation with results (resultsCount > 0), the log entry SHALL be created.
   * 
   * **Validates: Requirements 4.4**
   */
  it(
    'Property 5.5: Başarılı aramalar loglanmalı (resultsCount > 0)',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            fc.integer({ min: 1, max: 100 }), // En az 1 sonuç
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Başarılı arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde resultsCount > 0 olmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.resultsCount).toBeGreaterThan(0);
              expect(details.resultsCount).toBe(resultsCount);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.6: Tüm Arama Alanları Tek Bir Log Kaydında Bulunmalı
   * 
   * *For any* search operation (successful or zero-result), the log entry SHALL contain 
   * the search query, results count, and selected result (if any).
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it(
    'Property 5.6: Tüm arama alanları tek bir log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            resultsCountArbitrary,
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Tek bir log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde tüm alanlar bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              
              // Property: Event tipi search olmalı
              expect(details.event).toBe('search');
              
              // Property: Tüm zorunlu alanlar mevcut olmalı
              expect(details.query).toBe(query);
              expect(details.resultsCount).toBe(resultsCount);
              expect(details.selectedResult).toBe(selectedResult);
              
              // Property: Timestamp bulunmalı ve geçerli olmalı
              expect(details.timestamp).toBeDefined();
              const timestampDate = new Date(details.timestamp);
              expect(timestampDate.toString()).not.toBe('Invalid Date');

              // Property: Action search olmalı
              expect(log.action).toBe('search');

              return true;
            }
          ),
          {
            numRuns: 20,
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
// Property 6: Hassas Alan Filtreleme
// Feature: gelismis-loglama, Property 6: Hassas Alan Filtreleme
// **Validates: Requirements 5.1, 5.2, 5.3**
// ============================================================================

// Arbitraries for Sensitive Field Filtering Tests

/**
 * Hassas alan ID'leri oluşturan arbitrary
 * Password, kişisel veri ve finansal bilgi alanları
 */
const sensitiveFieldIdArbitrary = fc.constantFrom(
  // Password alanları
  'password',
  'passwordConfirm',
  'currentPassword',
  'newPassword',
  'passwd',
  'pwd',
  'parola',
  'sifre',
  'user_password',
  'login_password',
  
  // Kişisel veri alanları
  'ssn',
  'socialSecurityNumber',
  'social_security',
  'tcKimlik',
  'tc_kimlik_no',
  'kimlikNo',
  'identity_number',
  'nationalId',
  'national_id',
  
  // Finansal bilgiler
  'creditCard',
  'credit_card_number',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'expiry',
  'expiryDate',
  'iban',
  'accountNumber',
  'account_number',
  'hesapNo',
  'hesap_no',
  
  // İletişim bilgileri
  'phone',
  'phoneNumber',
  'telefon',
  'mobile',
  'mobilePhone',
  'cep',
  'cepTelefonu',
  
  // Sağlık bilgileri
  'health',
  'healthInfo',
  'medical',
  'medicalHistory',
  'saglik',
  
  // Güvenlik soruları
  'securityQuestion',
  'security_question',
  'securityAnswer',
  'security_answer',
  'secret',
  'secretAnswer',
  'pin',
  'pinCode',
  
  // Token ve API anahtarları
  'token',
  'accessToken',
  'apiKey',
  'api_key',
  'authToken',
  'auth_token',
  'bearer'
);

/**
 * Hassas form context'leri oluşturan arbitrary
 */
const sensitiveFormContextArbitrary = fc.constantFrom(
  'login',
  'loginForm',
  'signin',
  'signInForm',
  'signup',
  'signUpForm',
  'register',
  'registerForm',
  'password',
  'passwordReset',
  'changePassword',
  'payment',
  'paymentForm',
  'checkout',
  'checkoutForm',
  'billing',
  'billingForm',
  'credit',
  'creditCardForm',
  'bank',
  'bankTransfer'
);

/**
 * Normal (hassas olmayan) alan ID'leri oluşturan arbitrary
 */
const normalFieldIdArbitrary = fc.constantFrom(
  'username',
  'email',
  'firstName',
  'lastName',
  'address',
  'city',
  'country',
  'zipCode',
  'comment',
  'message',
  'description',
  'title',
  'subject',
  'content',
  'notes',
  'feedback',
  'searchQuery',
  'filterText',
  'category',
  'tag',
  'displayName',
  'company',
  'organization',
  'department',
  'position',
  'website',
  'homepage',
  'bio',
  'about'
);

/**
 * Normal (hassas olmayan) form context'leri oluşturan arbitrary
 */
const normalFormContextArbitrary = fc.constantFrom(
  'contact',
  'contactForm',
  'feedbackForm',
  'searchForm',
  'profile',
  'profileEdit',
  'settings',
  'preferences',
  'commentForm',
  'reviewForm',
  'inquiryForm',
  'newsletter',
  'subscription',
  'filterForm',
  'reportForm'
);

/**
 * Metin içeriği oluşturan arbitrary
 */
const textContentArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '),
  { minLength: 1, maxLength: 200 }
);

describe('Property Tests: Hassas Alan Filtreleme (Property 6)', () => {
  /**
   * Property 6.1: Hassas Alan ID'leri Loglanmamalı
   * 
   * *For any* text input from a sensitive field (password, personal data), 
   * the Logging_System SHALL NOT create a log entry for that input.
   * 
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it(
    'Property 6.1: Hassas alan ID\'leri loglanmamalı',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            sensitiveFieldIdArbitrary,
            normalFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Hassas alan bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false, // Otomatik tespit edilmeli
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: Hassas alan için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
   * Property 6.2: Hassas Form Context'leri Loglanmamalı
   * 
   * *For any* text input from a sensitive form context (login, payment, etc.), 
   * the Logging_System SHALL NOT create a log entry for that input.
   * 
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it(
    'Property 6.2: Hassas form context\'leri loglanmamalı',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            normalFieldIdArbitrary,
            sensitiveFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Hassas form context bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false, // Otomatik tespit edilmeli
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: Hassas form context için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
   * Property 6.3: isSensitive Flag'i True Olan Alanlar Loglanmamalı
   * 
   * *For any* text input with isSensitive = true, 
   * the Logging_System SHALL NOT create a log entry for that input.
   * 
   * **Validates: Requirements 5.3**
   */
  it(
    'Property 6.3: isSensitive flag\'i true olan alanlar loglanmamalı',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            normalFieldIdArbitrary,
            normalFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // isSensitive = true olan alan bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: true, // Açıkça hassas olarak işaretlenmiş
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: isSensitive = true için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
   * Property 6.4: Normal Alanlar Loglanmalı
   * 
   * *For any* text input from a non-sensitive field, 
   * the Logging_System SHALL create a log entry with the input content.
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6.4: Normal alanlar loglanmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            normalFieldIdArbitrary,
            normalFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Normal alan bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false,
              };

              // Log kaydı oluştur
              const log = await logTextInput(user.id, input, ipAddress);
              if (log) {
                createdLogIds.push(log.id);
              }

              // Property: Normal alan için log kaydı oluşturulmalı
              expect(log).not.toBeNull();
              expect(log).toBeDefined();
              expect(log!.id).toBeDefined();

              // Property: Details içinde alan bilgileri bulunmalı
              expect(log!.details).toBeDefined();
              const details = log!.details as TextInputDetails;
              expect(details.fieldId).toBe(fieldId);
              expect(details.formContext).toBe(formContext);
              
              // Property: İçerik kaydedilmiş olmalı (truncate edilmiş olabilir)
              const expectedContent = content.length > INPUT_TEXT_MAX_LENGTH 
                ? content.substring(0, INPUT_TEXT_MAX_LENGTH) 
                : content;
              expect(details.content).toBe(expectedContent);

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
   * Property 6.5: Hassas ve Normal Alan Kombinasyonları
   * 
   * *For any* combination of sensitive field ID with sensitive form context,
   * the Logging_System SHALL NOT create a log entry.
   * 
   * **Validates: Requirements 5.3**
   */
  it(
    'Property 6.5: Hassas alan ve hassas form context kombinasyonu loglanmamalı',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            sensitiveFieldIdArbitrary,
            sensitiveFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Hem hassas alan hem hassas form context
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false, // Otomatik tespit edilmeli
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: Hassas kombinasyon için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
// Unit-style Property Tests for Sensitive Field Detection Functions
// ============================================================================

describe('Property Tests: Hassas Alan Tespit Fonksiyonları', () => {
  /**
   * Property: isSensitiveField hassas alan ID'leri için true döndürmeli
   */
  it('isSensitiveField hassas alan ID\'leri için true döndürmeli', () => {
    fc.assert(
      fc.property(sensitiveFieldIdArbitrary, (fieldId) => {
        return isSensitiveField(fieldId, '') === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: isSensitiveField hassas form context'leri için true döndürmeli
   */
  it('isSensitiveField hassas form context\'leri için true döndürmeli', () => {
    fc.assert(
      fc.property(sensitiveFormContextArbitrary, (formContext) => {
        return isSensitiveField('', formContext) === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: isSensitiveField normal alanlar için false döndürmeli
   */
  it('isSensitiveField normal alanlar için false döndürmeli', () => {
    fc.assert(
      fc.property(normalFieldIdArbitrary, normalFormContextArbitrary, (fieldId, formContext) => {
        return isSensitiveField(fieldId, formContext) === false;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Boş değerler hassas kabul edilmemeli
   */
  it('isSensitiveField boş değerler için false döndürmeli', () => {
    expect(isSensitiveField('', '')).toBe(false);
  });
});

/**
 * Property 5.1: Arama Sorgusu Kaydedilmeli
 * 
 * *For any* search operation, the log entry SHALL contain the search query.
 * 
 * **Validates: Requirements 4.1**
 */
describe('Property Tests: Arama Loglama Ek Testler', () => {
  it(
    'Property 5.1: Arama sorgusu kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            resultsCountArbitrary,
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde query bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.query).toBeDefined();
              expect(details.query).toBe(query);

              // Property: Action search olmalı
              expect(log.action).toBe('search');

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.2: Sonuç Sayısının Kaydedilmesi
   * 
   * *For any* search operation, the log entry SHALL include the number of results returned.
   * 
   * **Validates: Requirements 4.2**
   */
  it(
    'Property 5.2: Sonuç sayısı kaydedilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            resultsCountArbitrary,
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde resultsCount bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.resultsCount).toBeDefined();
              expect(typeof details.resultsCount).toBe('number');
              expect(details.resultsCount).toBe(resultsCount);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.3: Seçilen Sonucun Kaydedilmesi
   * 
   * *For any* search operation where user clicks on a result, the log entry SHALL record the selected result.
   * 
   * **Validates: Requirements 4.3**
   */
  it(
    'Property 5.3: Seçilen sonuç kaydedilmeli (varsa)',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      // Sadece seçilen sonuç olan durumları test et
      const nonNullSelectedResultArbitrary = fc.oneof(
        fc.constantFrom(
          '/guide/introduction',
          '/penalties/traffic',
          '/procedures/arrest',
          '/commands/admin',
          '/guide/rules'
        ),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-/'), { minLength: 5, maxLength: 50 })
      );

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            fc.integer({ min: 1, max: 100 }), // En az 1 sonuç olmalı
            nonNullSelectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur (seçilen sonuç ile)
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde selectedResult bulunmalı ve değeri doğru olmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.selectedResult).toBeDefined();
              expect(details.selectedResult).toBe(selectedResult);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.4: Sonuçsuz Aramaların Loglanması
   * 
   * *For any* search operation with zero results, the log entry SHALL be created with resultsCount = 0.
   * 
   * **Validates: Requirements 4.4**
   */
  it(
    'Property 5.4: Sonuçsuz aramalar loglanmalı (resultsCount = 0)',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            validIPv4Arbitrary,
            async (query, ipAddress) => {
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

              // Sonuçsuz arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount: 0, // Sonuç yok
                selectedResult: null, // Seçilen sonuç da yok
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı (sonuçsuz aramalar da loglanmalı)
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde resultsCount 0 olmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.resultsCount).toBe(0);
              
              // Property: selectedResult null olmalı
              expect(details.selectedResult).toBeNull();

              // Property: Query hala kaydedilmiş olmalı
              expect(details.query).toBe(query);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.5: Başarılı Aramaların Loglanması
   * 
   * *For any* search operation with results (resultsCount > 0), the log entry SHALL be created.
   * 
   * **Validates: Requirements 4.4**
   */
  it(
    'Property 5.5: Başarılı aramalar loglanmalı (resultsCount > 0)',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            fc.integer({ min: 1, max: 100 }), // En az 1 sonuç
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Başarılı arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde resultsCount > 0 olmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              expect(details.resultsCount).toBeGreaterThan(0);
              expect(details.resultsCount).toBe(resultsCount);

              return true;
            }
          ),
          {
            numRuns: 20,
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
   * Property 5.6: Tüm Arama Alanları Tek Bir Log Kaydında Bulunmalı
   * 
   * *For any* search operation (successful or zero-result), the log entry SHALL contain 
   * the search query, results count, and selected result (if any).
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it(
    'Property 5.6: Tüm arama alanları tek bir log kaydında bulunmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            searchQueryArbitrary,
            resultsCountArbitrary,
            selectedResultArbitrary,
            validIPv4Arbitrary,
            async (query, resultsCount, selectedResult, ipAddress) => {
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

              // Arama bilgisi oluştur
              const search: SearchLog = {
                query,
                resultsCount,
                selectedResult,
              };

              // Log kaydı oluştur
              const log = await logSearchActivity(user.id, search, ipAddress);
              createdLogIds.push(log.id);

              // Property: Tek bir log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: Details içinde tüm alanlar bulunmalı
              expect(log.details).toBeDefined();
              const details = log.details as SearchActivityDetails;
              
              // Property: Event tipi search olmalı
              expect(details.event).toBe('search');
              
              // Property: Tüm zorunlu alanlar mevcut olmalı
              expect(details.query).toBe(query);
              expect(details.resultsCount).toBe(resultsCount);
              expect(details.selectedResult).toBe(selectedResult);
              
              // Property: Timestamp bulunmalı ve geçerli olmalı
              expect(details.timestamp).toBeDefined();
              const timestampDate = new Date(details.timestamp);
              expect(timestampDate.toString()).not.toBe('Invalid Date');

              // Property: Action search olmalı
              expect(log.action).toBe('search');

              return true;
            }
          ),
          {
            numRuns: 20,
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
// Property 6: Hassas Alan Filtreleme
// Feature: gelismis-loglama, Property 6: Hassas Alan Filtreleme
// **Validates: Requirements 5.1, 5.2, 5.3**
// ============================================================================

// Arbitraries for Sensitive Field Filtering Tests

/**
 * Hassas alan ID'leri oluşturan arbitrary
 * Password, kişisel veri ve finansal bilgi alanları
 */
const sensitiveFieldIdArbitrary = fc.constantFrom(
  // Password alanları
  'password',
  'passwordConfirm',
  'currentPassword',
  'newPassword',
  'passwd',
  'pwd',
  'parola',
  'sifre',
  'şifre',
  'user_password',
  'login_password',
  
  // Kişisel veri alanları
  'ssn',
  'socialSecurityNumber',
  'social_security',
  'tcKimlik',
  'tc_kimlik_no',
  'kimlikNo',
  'identity_number',
  'nationalId',
  'national_id',
  
  // Finansal bilgiler
  'creditCard',
  'credit_card_number',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'expiry',
  'expiryDate',
  'iban',
  'accountNumber',
  'account_number',
  'hesapNo',
  'hesap_no',
  
  // İletişim bilgileri
  'phone',
  'phoneNumber',
  'telefon',
  'mobile',
  'mobilePhone',
  'cep',
  'cepTelefonu',
  
  // Sağlık bilgileri
  'health',
  'healthInfo',
  'medical',
  'medicalHistory',
  'saglik',
  'sağlık',
  
  // Güvenlik soruları
  'securityQuestion',
  'security_question',
  'securityAnswer',
  'security_answer',
  'secret',
  'secretAnswer',
  'pin',
  'pinCode',
  
  // Token ve API anahtarları
  'token',
  'accessToken',
  'apiKey',
  'api_key',
  'authToken',
  'auth_token',
  'bearer'
);

/**
 * Hassas form context'leri oluşturan arbitrary
 */
const sensitiveFormContextArbitrary = fc.constantFrom(
  'login',
  'loginForm',
  'signin',
  'signInForm',
  'signup',
  'signUpForm',
  'register',
  'registerForm',
  'password',
  'passwordReset',
  'changePassword',
  'payment',
  'paymentForm',
  'checkout',
  'checkoutForm',
  'billing',
  'billingForm',
  'credit',
  'creditCardForm',
  'bank',
  'bankTransfer'
);

/**
 * Normal (hassas olmayan) alan ID'leri oluşturan arbitrary
 */
const normalFieldIdArbitrary = fc.constantFrom(
  'username',
  'email',
  'firstName',
  'lastName',
  'address',
  'city',
  'country',
  'zipCode',
  'comment',
  'message',
  'description',
  'title',
  'subject',
  'content',
  'notes',
  'feedback',
  'search',
  'query',
  'filter',
  'category',
  'tag',
  'name',
  'company',
  'organization',
  'department',
  'position',
  'website',
  'url',
  'bio',
  'about'
);

/**
 * Normal (hassas olmayan) form context'leri oluşturan arbitrary
 */
const normalFormContextArbitrary = fc.constantFrom(
  'contact',
  'contactForm',
  'feedback',
  'feedbackForm',
  'search',
  'searchForm',
  'profile',
  'profileEdit',
  'settings',
  'preferences',
  'comment',
  'commentForm',
  'review',
  'reviewForm',
  'inquiry',
  'inquiryForm',
  'newsletter',
  'subscription',
  'filter',
  'filterForm',
  'report',
  'reportForm'
);

/**
 * Metin içeriği oluşturan arbitrary
 */
const textContentArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:;@#$%&*()'),
  { minLength: 1, maxLength: 500 }
);

describe('Property Tests: Hassas Alan Filtreleme (Property 6)', () => {
  /**
   * Property 6.1: Hassas Alan ID'leri Loglanmamalı
   * 
   * *For any* text input from a sensitive field (password, personal data), 
   * the Logging_System SHALL NOT create a log entry for that input.
   * 
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it(
    'Property 6.1: Hassas alan ID\'leri loglanmamalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            sensitiveFieldIdArbitrary,
            normalFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Hassas alan bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false, // Otomatik tespit edilmeli
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: Hassas alan için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
   * Property 6.2: Hassas Form Context'leri Loglanmamalı
   * 
   * *For any* text input from a sensitive form context (login, payment, etc.), 
   * the Logging_System SHALL NOT create a log entry for that input.
   * 
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it(
    'Property 6.2: Hassas form context\'leri loglanmamalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            normalFieldIdArbitrary,
            sensitiveFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Hassas form context bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false, // Otomatik tespit edilmeli
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: Hassas form context için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
   * Property 6.3: isSensitive Flag'i True Olan Alanlar Loglanmamalı
   * 
   * *For any* text input with isSensitive = true, 
   * the Logging_System SHALL NOT create a log entry for that input.
   * 
   * **Validates: Requirements 5.3**
   */
  it(
    'Property 6.3: isSensitive flag\'i true olan alanlar loglanmamalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            normalFieldIdArbitrary,
            normalFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // isSensitive = true olan alan bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: true, // Açıkça hassas olarak işaretlenmiş
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: isSensitive = true için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
   * Property 6.4: Normal Alanlar Loglanmalı
   * 
   * *For any* text input from a non-sensitive field, 
   * the Logging_System SHALL create a log entry with the input content.
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  it(
    'Property 6.4: Normal alanlar loglanmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            normalFieldIdArbitrary,
            normalFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Normal alan bilgisi oluştur
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false,
              };

              // Log kaydı oluştur
              const log = await logTextInput(user.id, input, ipAddress);
              if (log) {
                createdLogIds.push(log.id);
              }

              // Property: Normal alan için log kaydı oluşturulmalı
              expect(log).not.toBeNull();
              expect(log).toBeDefined();
              expect(log!.id).toBeDefined();

              // Property: Details içinde alan bilgileri bulunmalı
              expect(log!.details).toBeDefined();
              const details = log!.details as TextInputDetails;
              expect(details.fieldId).toBe(fieldId);
              expect(details.formContext).toBe(formContext);
              
              // Property: İçerik kaydedilmiş olmalı (truncate edilmiş olabilir)
              const expectedContent = content.length > INPUT_TEXT_MAX_LENGTH 
                ? content.substring(0, INPUT_TEXT_MAX_LENGTH) 
                : content;
              expect(details.content).toBe(expectedContent);

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
   * Property 6.5: Hassas ve Normal Alan Kombinasyonları
   * 
   * *For any* combination of sensitive field ID with sensitive form context,
   * the Logging_System SHALL NOT create a log entry.
   * 
   * **Validates: Requirements 5.3**
   */
  it(
    'Property 6.5: Hassas alan ve hassas form context kombinasyonu loglanmamalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            sensitiveFieldIdArbitrary,
            sensitiveFormContextArbitrary,
            textContentArbitrary,
            validIPv4Arbitrary,
            async (fieldId, formContext, content, ipAddress) => {
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

              // Hem hassas alan hem hassas form context
              const input: TextInputLog = {
                fieldId,
                formContext,
                content,
                isSensitive: false, // Otomatik tespit edilmeli
              };

              // Log kaydı oluşturmayı dene
              const log = await logTextInput(user.id, input, ipAddress);

              // Property: Hassas kombinasyon için log kaydı oluşturulmamalı
              expect(log).toBeNull();

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
// Unit-style Property Tests for Sensitive Field Detection Functions
// ============================================================================

describe('Property Tests: Hassas Alan Tespit Fonksiyonları', () => {
  /**
   * Property: isSensitiveField hassas alan ID'leri için true döndürmeli
   */
  it('isSensitiveField hassas alan ID\'leri için true döndürmeli', () => {
    fc.assert(
      fc.property(sensitiveFieldIdArbitrary, (fieldId) => {
        return isSensitiveField(fieldId, '') === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: isSensitiveField hassas form context'leri için true döndürmeli
   */
  it('isSensitiveField hassas form context\'leri için true döndürmeli', () => {
    fc.assert(
      fc.property(sensitiveFormContextArbitrary, (formContext) => {
        return isSensitiveField('', formContext) === true;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: isSensitiveField normal alanlar için false döndürmeli
   */
  it('isSensitiveField normal alanlar için false döndürmeli', () => {
    fc.assert(
      fc.property(normalFieldIdArbitrary, normalFormContextArbitrary, (fieldId, formContext) => {
        return isSensitiveField(fieldId, formContext) === false;
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Boş değerler hassas kabul edilmemeli
   */
  it('isSensitiveField boş değerler için false döndürmeli', () => {
    expect(isSensitiveField('', '')).toBe(false);
  });
});


// ============================================================================
// Property 3: Metin Truncation
// Feature: gelismis-loglama, Property 3: Metin Truncation
// **Validates: Requirements 2.4, 5.4, 10.3**
// ============================================================================

// Arbitraries for Truncation Tests

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


// ============================================================================
// Property 12: Metin Kopyalama Loglama
// Feature: gelismis-loglama, Property 12: Metin Kopyalama Loglama
// **Validates: Requirements 10.1, 10.2, 10.4**
// ============================================================================

// Arbitraries for Text Copy Tests

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
 * Geçerli IPv4 adresi oluşturan arbitrary (Property 12 için)
 */
const validIPv4ArbitraryP12 = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

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
            validIPv4ArbitraryP12,
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
            validIPv4ArbitraryP12,
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
            validIPv4ArbitraryP12,
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
            validIPv4ArbitraryP12,
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


// ============================================================================
// Property 12: Metin Kopyalama Loglama
// Feature: gelismis-loglama, Property 12: Metin Kopyalama Loglama
// **Validates: Requirements 10.1, 10.2, 10.4**
// ============================================================================

// Arbitraries for Text Copy Tests

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
 * Geçerli IPv4 adresi oluşturan arbitrary (Property 12 için)
 */
const validIPv4ArbitraryP12 = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

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
            validIPv4ArbitraryP12,
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
            validIPv4ArbitraryP12,
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
            validIPv4ArbitraryP12,
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
            validIPv4ArbitraryP12,
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
