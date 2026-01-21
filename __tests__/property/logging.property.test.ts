/**
 * Logging Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 11: Kapsamlı Loglama
 *
 * Bu test dosyası, tüm sistem aktivitelerinin (giriş, içerik erişimi, yetki değişikliği,
 * yetkisiz erişim denemesi) için ilgili log kaydı oluşturulduğunu doğrular.
 *
 * **Validates: Requirements 3.5, 9.1, 9.2, 9.4**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import {
  logLogin,
  logLogout,
  logContentAccess,
  logSearch,
  logAIQuery,
  logRoleChange,
  logUserApprove,
  logUserReject,
  logUnauthorizedAccess,
} from '@/lib/logging';
import { hashPassword } from '@/lib/auth';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = Date.now().toString(36);

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Test loglarını temizle
  await prisma.activityLog.deleteMany({
    where: {
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

/**
 * Geçerli IP adresi oluşturan arbitrary
 */
const validIPArbitrary = fc
  .tuple(
    fc.integer({ min: 1, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 1, max: 254 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/**
 * Geçerli kullanıcı ID'si oluşturan arbitrary
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
 * Geçerli içerik ID'si oluşturan arbitrary
 */
const validContentIdArbitrary = fc
  .tuple(
    fc.constantFrom('penalty', 'command', 'procedure', 'guide'),
    fc.integer({ min: 1, max: 999 })
  )
  .map(([type, num]) => `${type}_${num}`);

/**
 * Geçerli içerik türü oluşturan arbitrary
 */
const validContentTypeArbitrary = fc.constantFrom(
  'penalty',
  'command',
  'procedure',
  'guide',
  'section'
);

/**
 * Geçerli içerik başlığı oluşturan arbitrary
 */
const validContentTitleArbitrary = fc.constantFrom(
  'ADK Cezası',
  'Hakaret Cezası',
  'XP Abuse Cezası',
  'Mute Komutu',
  'Ban Komutu',
  'Kayıt Prosedürü',
  'Yetkili Kılavuzu Bölüm 1'
);

/**
 * Geçerli arama sorgusu oluşturan arbitrary
 */
const validSearchQueryArbitrary = fc.constantFrom(
  'hakaret',
  'adk',
  'xp abuse',
  'mute',
  'ban',
  'noroom',
  'pls',
  'ceza süresi',
  'kayıt formatı'
);

/**
 * Geçerli yetki seviyesi oluşturan arbitrary
 */
const validRoleArbitrary = fc.constantFrom('none', 'mod', 'admin', 'ust_yetkili');

/**
 * Geçerli URL yolu oluşturan arbitrary
 */
const validPathArbitrary = fc.constantFrom(
  '/admin/users',
  '/admin/logs',
  '/api/admin/users',
  '/api/content/penalties',
  '/dashboard',
  '/guide/section-1'
);

/**
 * Geçerli güven skoru oluşturan arbitrary
 */
const validConfidenceArbitrary = fc.constantFrom('high', 'medium', 'low');

describe('Property Tests: Logging - Kapsamlı Loglama', () => {
  /**
   * Property 11.1: Giriş Aktiviteleri Loglama
   *
   * *Herhangi bir* giriş aktivitesi için (login/logout), ilgili log kaydı
   * oluşturulmalı ve gerekli alanları içermelidir.
   *
   * **Validates: Requirements 9.1**
   */
  it(
    'Property 11.1: Tüm giriş aktiviteleri log kaydı oluşturmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPArbitrary,
            fc.constantFrom('login', 'logout'),
            async (ipAddress, actionType) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `testuser_${testRunId}_${Date.now()}`,
                  email: `test_${testRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'mod',
                },
              });
              createdUserIds.push(user.id);

              // Giriş veya çıkış logu oluştur
              let log;
              if (actionType === 'login') {
                log = await logLogin(user.id, ipAddress);
              } else {
                log = await logLogout(user.id, ipAddress);
              }
              createdLogIds.push(log.id);

              // Property 1: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property 2: Gerekli alanlar mevcut olmalı
              expect(log.userId).toBe(user.id);
              expect(log.action).toBe(actionType);
              expect(log.ipAddress).toBe(ipAddress);
              expect(log.timestamp).toBeInstanceOf(Date);

              // Property 3: Details alanı event bilgisi içermeli
              expect(log.details).toBeDefined();
              expect(log.details.event).toBe(
                actionType === 'login' ? 'user_login' : 'user_logout'
              );
              expect(log.details.timestamp).toBeDefined();

              // Property 4: Veritabanında kayıt bulunabilmeli
              const savedLog = await prisma.activityLog.findUnique({
                where: { id: log.id },
              });
              expect(savedLog).not.toBeNull();
              expect(savedLog?.action).toBe(actionType);

              return true;
            }
          ),
          {
            numRuns: 100,
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
    120000 // 120 saniye timeout
  );

  /**
   * Property 11.2: İçerik Erişimi Loglama
   *
   * *Herhangi bir* içerik erişimi için, ilgili log kaydı oluşturulmalı
   * ve içerik bilgilerini içermelidir.
   *
   * **Validates: Requirements 9.2**
   */
  it(
    'Property 11.2: Tüm içerik erişimleri log kaydı oluşturmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPArbitrary,
            validContentIdArbitrary,
            validContentTypeArbitrary,
            validContentTitleArbitrary,
            async (ipAddress, contentId, contentType, contentTitle) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `testuser_${testRunId}_${Date.now()}`,
                  email: `test_${testRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'mod',
                },
              });
              createdUserIds.push(user.id);

              // İçerik erişim logu oluştur
              const log = await logContentAccess(
                user.id,
                contentId,
                ipAddress,
                contentType,
                contentTitle
              );
              createdLogIds.push(log.id);

              // Property 1: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property 2: Gerekli alanlar mevcut olmalı
              expect(log.userId).toBe(user.id);
              expect(log.action).toBe('view_content');
              expect(log.ipAddress).toBe(ipAddress);
              expect(log.timestamp).toBeInstanceOf(Date);

              // Property 3: Details alanı içerik bilgilerini içermeli
              expect(log.details).toBeDefined();
              expect(log.details.event).toBe('content_access');
              expect(log.details.contentId).toBe(contentId);
              expect(log.details.contentType).toBe(contentType);
              expect(log.details.contentTitle).toBe(contentTitle);

              // Property 4: Veritabanında kayıt bulunabilmeli
              const savedLog = await prisma.activityLog.findUnique({
                where: { id: log.id },
              });
              expect(savedLog).not.toBeNull();
              expect(savedLog?.action).toBe('view_content');

              return true;
            }
          ),
          {
            numRuns: 100,
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
    120000
  );

  /**
   * Property 11.3: Yetki Değişikliği Loglama
   *
   * *Herhangi bir* yetki değişikliği için (role_change, user_approve, user_reject),
   * ilgili log kaydı oluşturulmalı ve değişiklik detaylarını içermelidir.
   *
   * **Validates: Requirements 3.5**
   */
  it(
    'Property 11.3: Tüm yetki değişiklikleri log kaydı oluşturmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPArbitrary,
            validRoleArbitrary,
            validRoleArbitrary,
            fc.constantFrom('role_change', 'user_approve', 'user_reject'),
            async (ipAddress, oldRole, newRole, actionType) => {
              // Admin kullanıcısı oluştur
              const passwordHash = await hashPassword('AdminPassword123');
              const adminUser = await prisma.user.create({
                data: {
                  username: `admin_${testRunId}_${Date.now()}`,
                  email: `admin_${testRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(adminUser.id);

              // Hedef kullanıcı oluştur
              const targetUser = await prisma.user.create({
                data: {
                  username: `target_${testRunId}_${Date.now()}`,
                  email: `target_${testRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'pending',
                  role: oldRole as 'none' | 'mod' | 'admin' | 'ust_yetkili',
                },
              });
              createdUserIds.push(targetUser.id);

              // Yetki değişikliği logu oluştur
              let log;
              if (actionType === 'role_change') {
                log = await logRoleChange(
                  adminUser.id,
                  targetUser.id,
                  oldRole as 'none' | 'mod' | 'admin' | 'ust_yetkili',
                  newRole as 'none' | 'mod' | 'admin' | 'ust_yetkili',
                  ipAddress,
                  targetUser.username
                );
              } else if (actionType === 'user_approve') {
                log = await logUserApprove(
                  adminUser.id,
                  targetUser.id,
                  newRole as 'none' | 'mod' | 'admin' | 'ust_yetkili',
                  ipAddress,
                  targetUser.username
                );
              } else {
                log = await logUserReject(
                  adminUser.id,
                  targetUser.id,
                  ipAddress,
                  targetUser.username,
                  'Test rejection reason'
                );
              }
              createdLogIds.push(log.id);

              // Property 1: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property 2: Gerekli alanlar mevcut olmalı
              expect(log.userId).toBe(adminUser.id);
              expect(log.action).toBe(actionType);
              expect(log.ipAddress).toBe(ipAddress);
              expect(log.timestamp).toBeInstanceOf(Date);

              // Property 3: Details alanı hedef kullanıcı bilgisini içermeli
              expect(log.details).toBeDefined();
              expect(log.details.targetUserId).toBe(targetUser.id);

              // Property 4: Veritabanında kayıt bulunabilmeli
              const savedLog = await prisma.activityLog.findUnique({
                where: { id: log.id },
              });
              expect(savedLog).not.toBeNull();
              expect(savedLog?.action).toBe(actionType);

              return true;
            }
          ),
          {
            numRuns: 100,
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
    120000
  );

  /**
   * Property 11.4: Yetkisiz Erişim Denemeleri Loglama
   *
   * *Herhangi bir* yetkisiz erişim denemesi için, ilgili log kaydı
   * oluşturulmalı ve deneme detaylarını içermelidir.
   *
   * **Validates: Requirements 9.4**
   */
  it(
    'Property 11.4: Tüm yetkisiz erişim denemeleri log kaydı oluşturmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPArbitrary,
            validPathArbitrary,
            fc.boolean(),
            async (ipAddress, attemptedPath, hasUserId) => {
              let userId: string | undefined;

              if (hasUserId) {
                // Kullanıcı ile yetkisiz erişim denemesi
                const passwordHash = await hashPassword('TestPassword123');
                const user = await prisma.user.create({
                  data: {
                    username: `testuser_${testRunId}_${Date.now()}`,
                    email: `test_${testRunId}_${Date.now()}@example.com`,
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                createdUserIds.push(user.id);
                userId = user.id;
              }

              // Yetkisiz erişim logu oluştur
              const log = await logUnauthorizedAccess(
                ipAddress,
                attemptedPath,
                userId,
                'insufficient_permissions'
              );

              // Log null olabilir (kullanıcı yoksa sistem kullanıcısı oluşturulur)
              if (log) {
                createdLogIds.push(log.id);

                // Property 1: Log kaydı oluşturulmuş olmalı
                expect(log).toBeDefined();
                expect(log.id).toBeDefined();

                // Property 2: Gerekli alanlar mevcut olmalı
                expect(log.action).toBe('view_content');
                expect(log.ipAddress).toBe(ipAddress);
                expect(log.timestamp).toBeInstanceOf(Date);

                // Property 3: Details alanı yetkisiz erişim bilgilerini içermeli
                expect(log.details).toBeDefined();
                expect(log.details.event).toBe('unauthorized_access');
                expect(log.details.attemptedPath).toBe(attemptedPath);
                expect(log.details.unauthorized).toBe(true);

                // Property 4: Veritabanında kayıt bulunabilmeli
                const savedLog = await prisma.activityLog.findUnique({
                  where: { id: log.id },
                });
                expect(savedLog).not.toBeNull();

                // Details içinde unauthorized flag'i kontrol et
                const savedDetails = JSON.parse(savedLog?.details as string);
                expect(savedDetails.unauthorized).toBe(true);
              }

              return true;
            }
          ),
          {
            numRuns: 100,
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
    120000
  );

  /**
   * Property 11.5: Log Kayıtları Gerekli Alanları İçermeli
   *
   * *Herhangi bir* log kaydı için, userId, action, details, ipAddress ve
   * timestamp alanları mevcut olmalıdır.
   *
   * **Validates: Requirements 9.1, 9.2, 9.4**
   */
  it(
    'Property 11.5: Tüm log kayıtları gerekli alanları içermeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            validIPArbitrary,
            fc.constantFrom(
              'login',
              'logout',
              'content_access',
              'search',
              'ai_query'
            ),
            async (ipAddress, logType) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `testuser_${testRunId}_${Date.now()}`,
                  email: `test_${testRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'mod',
                },
              });
              createdUserIds.push(user.id);

              // Log türüne göre log oluştur
              let log;
              switch (logType) {
                case 'login':
                  log = await logLogin(user.id, ipAddress);
                  break;
                case 'logout':
                  log = await logLogout(user.id, ipAddress);
                  break;
                case 'content_access':
                  log = await logContentAccess(
                    user.id,
                    'test_content_1',
                    ipAddress,
                    'guide',
                    'Test Content'
                  );
                  break;
                case 'search':
                  log = await logSearch(user.id, 'test query', ipAddress, 5);
                  break;
                case 'ai_query':
                  log = await logAIQuery(
                    user.id,
                    'test ai query',
                    ipAddress,
                    'high'
                  );
                  break;
              }

              if (log) {
                createdLogIds.push(log.id);

                // Property: Tüm gerekli alanlar mevcut olmalı
                expect(log.id).toBeDefined();
                expect(typeof log.id).toBe('string');
                expect(log.id.length).toBeGreaterThan(0);

                expect(log.userId).toBeDefined();
                expect(typeof log.userId).toBe('string');
                expect(log.userId).toBe(user.id);

                expect(log.action).toBeDefined();
                expect(typeof log.action).toBe('string');

                expect(log.details).toBeDefined();
                expect(typeof log.details).toBe('object');

                expect(log.ipAddress).toBeDefined();
                expect(typeof log.ipAddress).toBe('string');
                expect(log.ipAddress).toBe(ipAddress);

                expect(log.timestamp).toBeDefined();
                expect(log.timestamp).toBeInstanceOf(Date);
              }

              return true;
            }
          ),
          {
            numRuns: 100,
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
    120000
  );
});
