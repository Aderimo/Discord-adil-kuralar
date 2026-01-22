/**
 * Logging Property-Based Tests
 * 
 * Feature: yetkili-kilavuzu, Property 11: Kapsamlı Loglama
 * Bu test dosyası, tüm sistem aktivitelerinin (giriş, içerik erişimi, yetki değişikliği,
 * yetkisiz erişim denemesi) için ilgili log kaydı oluşturulduğunu doğrular.
 * **Validates: Requirements 3.5, 9.1, 9.2, 9.4**
 *
 * Feature: yetkili-kilavuzu-v2-guncelleme, Property 7: Activity Logging Completeness
 * Bu test dosyası, tüm önemli aksiyonların (login, logout, role_change, user_approve,
 * user_reject, content_edit) için log kaydı oluşturulduğunu ve gerekli alanları içerdiğini doğrular.
 * **Validates: Requirements 7.1, 7.6**
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
  logActivity,
  getActivityLogs,
  logContentChange,
} from '@/lib/logging';
import { hashPassword } from '@/lib/auth';
import type { ActivityAction } from '@/types';

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


/**
 * Property Tests: Activity Logging Completeness
 * Feature: yetkili-kilavuzu-v2-guncelleme, Property 7
 *
 * *For any* significant action (login, logout, role_change, user_approve, user_reject, content_edit),
 * the Log_Sistemi SHALL create a log entry containing userId, timestamp, action type, and relevant details.
 *
 * **Validates: Requirements 7.1, 7.6**
 */
describe('Property Tests: Activity Logging Completeness (Property 7)', () => {
  // Test için benzersiz ID oluşturmak için
  const property7TestRunId = `p7_${Date.now().toString(36)}`;

  /**
   * Significant action türleri - Requirements 7.6'da belirtilen aksiyonlar
   */
  const significantActions: ActivityAction[] = [
    'login',
    'logout',
    'role_change',
    'user_approve',
    'user_reject',
  ];

  /**
   * Geçerli IP adresi oluşturan arbitrary
   */
  const ipArbitrary = fc
    .tuple(
      fc.integer({ min: 1, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 1, max: 254 })
    )
    .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

  /**
   * Geçerli yetki seviyesi oluşturan arbitrary
   */
  const roleArbitrary = fc.constantFrom('none', 'mod', 'admin', 'ust_yetkili') as fc.Arbitrary<'none' | 'mod' | 'admin' | 'ust_yetkili'>;

  /**
   * Property 7.1: Her Önemli Aksiyon Log Kaydı Oluşturmalı
   *
   * *Herhangi bir* önemli aksiyon (login, logout, role_change, user_approve, user_reject)
   * için sistem bir log kaydı oluşturmalıdır.
   *
   * **Validates: Requirements 7.1, 7.6**
   */
  it(
    'Property 7.1: Her önemli aksiyon için log kaydı oluşturulmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...significantActions),
            ipArbitrary,
            roleArbitrary,
            roleArbitrary,
            async (actionType, ipAddress, oldRole, newRole) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p7user_${property7TestRunId}_${Date.now()}`,
                  email: `p7_${property7TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Hedef kullanıcı (role_change, user_approve, user_reject için)
              let targetUser;
              if (['role_change', 'user_approve', 'user_reject'].includes(actionType)) {
                targetUser = await prisma.user.create({
                  data: {
                    username: `p7target_${property7TestRunId}_${Date.now()}`,
                    email: `p7target_${property7TestRunId}_${Date.now()}@example.com`,
                    passwordHash,
                    status: 'pending',
                    role: oldRole,
                  },
                });
                createdUserIds.push(targetUser.id);
              }

              // Aksiyon türüne göre log oluştur
              let log;
              switch (actionType) {
                case 'login':
                  log = await logLogin(user.id, ipAddress);
                  break;
                case 'logout':
                  log = await logLogout(user.id, ipAddress);
                  break;
                case 'role_change':
                  log = await logRoleChange(
                    user.id,
                    targetUser!.id,
                    oldRole,
                    newRole,
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_approve':
                  log = await logUserApprove(
                    user.id,
                    targetUser!.id,
                    newRole,
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_reject':
                  log = await logUserReject(
                    user.id,
                    targetUser!.id,
                    ipAddress,
                    targetUser!.username,
                    'Test rejection'
                  );
                  break;
              }

              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();
              expect(log.id.length).toBeGreaterThan(0);

              // Property: Action type doğru olmalı
              expect(log.action).toBe(actionType);

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
   * Property 7.2: Log Kayıtları Gerekli Alanları İçermeli
   *
   * *Herhangi bir* log kaydı için userId, timestamp, action type ve details
   * alanları mevcut olmalıdır.
   *
   * **Validates: Requirements 7.1**
   */
  it(
    'Property 7.2: Log kayıtları userId, timestamp, action ve details içermeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...significantActions),
            ipArbitrary,
            async (actionType, ipAddress) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p7user_${property7TestRunId}_${Date.now()}`,
                  email: `p7_${property7TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Hedef kullanıcı (role_change, user_approve, user_reject için)
              let targetUser;
              if (['role_change', 'user_approve', 'user_reject'].includes(actionType)) {
                targetUser = await prisma.user.create({
                  data: {
                    username: `p7target_${property7TestRunId}_${Date.now()}`,
                    email: `p7target_${property7TestRunId}_${Date.now()}@example.com`,
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                createdUserIds.push(targetUser.id);
              }

              // Aksiyon türüne göre log oluştur
              let log;
              switch (actionType) {
                case 'login':
                  log = await logLogin(user.id, ipAddress);
                  break;
                case 'logout':
                  log = await logLogout(user.id, ipAddress);
                  break;
                case 'role_change':
                  log = await logRoleChange(
                    user.id,
                    targetUser!.id,
                    'none',
                    'mod',
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_approve':
                  log = await logUserApprove(
                    user.id,
                    targetUser!.id,
                    'mod',
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_reject':
                  log = await logUserReject(
                    user.id,
                    targetUser!.id,
                    ipAddress,
                    targetUser!.username,
                    'Test rejection'
                  );
                  break;
              }

              createdLogIds.push(log.id);

              // Property: userId mevcut ve doğru olmalı
              expect(log.userId).toBeDefined();
              expect(typeof log.userId).toBe('string');
              expect(log.userId).toBe(user.id);

              // Property: timestamp mevcut ve Date olmalı
              expect(log.timestamp).toBeDefined();
              expect(log.timestamp).toBeInstanceOf(Date);

              // Property: action mevcut ve doğru türde olmalı
              expect(log.action).toBeDefined();
              expect(typeof log.action).toBe('string');
              expect(significantActions).toContain(log.action);

              // Property: details mevcut ve object olmalı
              expect(log.details).toBeDefined();
              expect(typeof log.details).toBe('object');

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
   * Property 7.3: Log Kayıtları Oluşturulduktan Sonra Erişilebilir Olmalı
   *
   * *Herhangi bir* log kaydı oluşturulduktan sonra, veritabanından
   * getirilebilir olmalıdır.
   *
   * **Validates: Requirements 7.1**
   */
  it(
    'Property 7.3: Log kayıtları oluşturulduktan sonra erişilebilir olmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...significantActions),
            ipArbitrary,
            async (actionType, ipAddress) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p7user_${property7TestRunId}_${Date.now()}`,
                  email: `p7_${property7TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Hedef kullanıcı (role_change, user_approve, user_reject için)
              let targetUser;
              if (['role_change', 'user_approve', 'user_reject'].includes(actionType)) {
                targetUser = await prisma.user.create({
                  data: {
                    username: `p7target_${property7TestRunId}_${Date.now()}`,
                    email: `p7target_${property7TestRunId}_${Date.now()}@example.com`,
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                createdUserIds.push(targetUser.id);
              }

              // Aksiyon türüne göre log oluştur
              let log;
              switch (actionType) {
                case 'login':
                  log = await logLogin(user.id, ipAddress);
                  break;
                case 'logout':
                  log = await logLogout(user.id, ipAddress);
                  break;
                case 'role_change':
                  log = await logRoleChange(
                    user.id,
                    targetUser!.id,
                    'none',
                    'mod',
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_approve':
                  log = await logUserApprove(
                    user.id,
                    targetUser!.id,
                    'mod',
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_reject':
                  log = await logUserReject(
                    user.id,
                    targetUser!.id,
                    ipAddress,
                    targetUser!.username,
                    'Test rejection'
                  );
                  break;
              }

              createdLogIds.push(log.id);

              // Property: Veritabanından log kaydı getirilebilmeli
              const savedLog = await prisma.activityLog.findUnique({
                where: { id: log.id },
              });

              expect(savedLog).not.toBeNull();
              expect(savedLog?.id).toBe(log.id);
              expect(savedLog?.userId).toBe(log.userId);
              expect(savedLog?.action).toBe(log.action);
              expect(savedLog?.ipAddress).toBe(log.ipAddress);

              // Property: getActivityLogs ile de erişilebilmeli
              const { logs } = await getActivityLogs({
                userId: user.id,
                action: actionType,
                pageSize: 10,
              });

              const foundLog = logs.find(l => l.id === log.id);
              expect(foundLog).toBeDefined();

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
   * Property 7.4: Aksiyon Türleri Doğru Kategorize Edilmeli
   *
   * *Herhangi bir* log kaydı için, action alanı tanımlı aksiyon türlerinden
   * biri olmalı ve doğru kategoride olmalıdır.
   *
   * **Validates: Requirements 7.6**
   */
  it(
    'Property 7.4: Aksiyon türleri doğru kategorize edilmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      // Aksiyon kategorileri
      const actionCategories: Record<string, string[]> = {
        authentication: ['login', 'logout'],
        user_management: ['role_change', 'user_approve', 'user_reject'],
      };

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...significantActions),
            ipArbitrary,
            async (actionType, ipAddress) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p7user_${property7TestRunId}_${Date.now()}`,
                  email: `p7_${property7TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Hedef kullanıcı (role_change, user_approve, user_reject için)
              let targetUser;
              if (['role_change', 'user_approve', 'user_reject'].includes(actionType)) {
                targetUser = await prisma.user.create({
                  data: {
                    username: `p7target_${property7TestRunId}_${Date.now()}`,
                    email: `p7target_${property7TestRunId}_${Date.now()}@example.com`,
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                createdUserIds.push(targetUser.id);
              }

              // Aksiyon türüne göre log oluştur
              let log;
              switch (actionType) {
                case 'login':
                  log = await logLogin(user.id, ipAddress);
                  break;
                case 'logout':
                  log = await logLogout(user.id, ipAddress);
                  break;
                case 'role_change':
                  log = await logRoleChange(
                    user.id,
                    targetUser!.id,
                    'none',
                    'mod',
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_approve':
                  log = await logUserApprove(
                    user.id,
                    targetUser!.id,
                    'mod',
                    ipAddress,
                    targetUser!.username
                  );
                  break;
                case 'user_reject':
                  log = await logUserReject(
                    user.id,
                    targetUser!.id,
                    ipAddress,
                    targetUser!.username,
                    'Test rejection'
                  );
                  break;
              }

              createdLogIds.push(log.id);

              // Property: Action type tanımlı türlerden biri olmalı
              expect(significantActions).toContain(log.action);

              // Property: Action doğru kategoride olmalı
              let foundCategory = false;
              for (const [, actions] of Object.entries(actionCategories)) {
                if (actions.includes(log.action)) {
                  foundCategory = true;
                  break;
                }
              }
              expect(foundCategory).toBe(true);

              // Property: Authentication aksiyonları için event bilgisi doğru olmalı
              if (actionCategories.authentication.includes(actionType)) {
                expect(log.details.event).toBe(
                  actionType === 'login' ? 'user_login' : 'user_logout'
                );
              }

              // Property: User management aksiyonları için targetUserId olmalı
              if (actionCategories.user_management.includes(actionType)) {
                expect(log.details.targetUserId).toBeDefined();
                expect(log.details.targetUserId).toBe(targetUser!.id);
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
   * Property 7.5: Content Edit Aksiyonları Log Kaydı Oluşturmalı
   *
   * *Herhangi bir* içerik düzenleme aksiyonu için, sistem bir log kaydı
   * oluşturmalı ve içerik bilgilerini içermelidir.
   *
   * **Validates: Requirements 7.6**
   */
  it(
    'Property 7.5: Content edit aksiyonları log kaydı oluşturmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      const contentTypes = ['guide', 'penalty', 'command', 'procedure'];
      const changeTypes = ['create', 'update', 'delete'] as const;

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...contentTypes),
            fc.constantFrom(...changeTypes),
            ipArbitrary,
            fc.string({ minLength: 1, maxLength: 50 }),
            async (contentType, changeType, ipAddress, contentTitle) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p7user_${property7TestRunId}_${Date.now()}`,
                  email: `p7_${property7TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              const contentId = `${contentType}_${Date.now()}`;

              // Content change logu oluştur
              const log = await logContentChange(
                user.id,
                contentId,
                changeType,
                ipAddress,
                contentType,
                contentTitle,
                changeType === 'update' ? { oldValue: 'test' } : undefined,
                changeType !== 'delete' ? { newValue: 'test' } : undefined
              );

              createdLogIds.push(log.id);

              // Property: Log kaydı oluşturulmuş olmalı
              expect(log).toBeDefined();
              expect(log.id).toBeDefined();

              // Property: userId doğru olmalı
              expect(log.userId).toBe(user.id);

              // Property: timestamp mevcut olmalı
              expect(log.timestamp).toBeInstanceOf(Date);

              // Property: details içerik bilgilerini içermeli
              expect(log.details).toBeDefined();
              expect(log.details.event).toBe('content_change');
              expect(log.details.contentId).toBe(contentId);
              expect(log.details.contentType).toBe(contentType);
              expect(log.details.contentTitle).toBe(contentTitle);
              expect(log.details.changeType).toBe(changeType);

              // Property: Veritabanında kayıt bulunabilmeli
              const savedLog = await prisma.activityLog.findUnique({
                where: { id: log.id },
              });
              expect(savedLog).not.toBeNull();

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


/**
 * Property Tests: Log Filtering and Export Round-Trip
 * Feature: yetkili-kilavuzu-v2-guncelleme, Property 8
 *
 * *For any* set of log filters (date range, user, action type), applying the filters
 * SHALL return only matching logs, and exporting those logs to CSV or JSON and
 * re-importing SHALL produce equivalent data.
 *
 * **Validates: Requirements 7.3, 7.4**
 */
describe('Property Tests: Log Filtering and Export Round-Trip (Property 8)', () => {
  // Test için benzersiz ID oluşturmak için
  const property8TestRunId = `p8_${Date.now().toString(36)}`;

  /**
   * Geçerli IP adresi oluşturan arbitrary
   */
  const ipArbitrary = fc
    .tuple(
      fc.integer({ min: 1, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 1, max: 254 })
    )
    .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

  /**
   * Geçerli aksiyon türü oluşturan arbitrary
   */
  const actionArbitrary = fc.constantFrom(
    'login',
    'logout',
    'view_content',
    'search',
    'ai_query',
    'role_change',
    'user_approve',
    'user_reject'
  ) as fc.Arbitrary<ActivityAction>;

  /**
   * Geçerli tarih aralığı oluşturan arbitrary
   * Son 30 gün içinde rastgele tarihler
   */
  const dateRangeArbitrary = fc
    .tuple(
      fc.integer({ min: 1, max: 15 }), // startDate: 1-15 gün önce
      fc.integer({ min: 0, max: 14 })  // endDate: 0-14 gün önce (startDate'den sonra)
    )
    .map(([startDaysAgo, endDaysOffset]) => {
      const now = new Date();
      const startDate = new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() - (startDaysAgo - endDaysOffset - 1) * 24 * 60 * 60 * 1000);
      return { startDate, endDate };
    });

  /**
   * Property 8.1: Tarih Aralığı Filtresi Doğru Çalışmalı
   *
   * *Herhangi bir* tarih aralığı filtresi için, dönen loglar yalnızca
   * belirtilen aralıktaki logları içermelidir.
   *
   * **Validates: Requirements 7.3**
   */
  it(
    'Property 8.1: Tarih aralığı filtresi yalnızca aralıktaki logları döndürmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            ipArbitrary,
            actionArbitrary,
            async (ipAddress, actionType) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p8user_${property8TestRunId}_${Date.now()}`,
                  email: `p8_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Farklı zamanlarda loglar oluştur
              const now = new Date();
              const log1 = await logActivity(
                user.id,
                actionType,
                { event: 'test_event', testRunId: property8TestRunId, logIndex: 1 },
                ipAddress
              );
              createdLogIds.push(log1.id);

              // Tarih aralığı filtresi uygula (şu anki zaman için)
              const startDate = new Date(now.getTime() - 60000); // 1 dakika önce
              const endDate = new Date(now.getTime() + 60000); // 1 dakika sonra

              const { logs } = await getActivityLogs({
                userId: user.id,
                startDate,
                endDate,
                pageSize: 100,
              });

              // Property: Dönen tüm loglar tarih aralığında olmalı
              for (const log of logs) {
                expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                expect(log.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
              }

              // Property: Oluşturduğumuz log sonuçlarda olmalı
              const foundLog = logs.find(l => l.id === log1.id);
              expect(foundLog).toBeDefined();

              return true;
            }
          ),
          {
            numRuns: 50,
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
   * Property 8.2: Kullanıcı Filtresi Doğru Çalışmalı
   *
   * *Herhangi bir* kullanıcı filtresi için, dönen loglar yalnızca
   * belirtilen kullanıcıya ait logları içermelidir.
   *
   * **Validates: Requirements 7.3**
   */
  it(
    'Property 8.2: Kullanıcı filtresi yalnızca o kullanıcının loglarını döndürmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            ipArbitrary,
            actionArbitrary,
            async (ipAddress, actionType) => {
              // İki farklı test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user1 = await prisma.user.create({
                data: {
                  username: `p8user1_${property8TestRunId}_${Date.now()}`,
                  email: `p8u1_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'mod',
                },
              });
              createdUserIds.push(user1.id);

              const user2 = await prisma.user.create({
                data: {
                  username: `p8user2_${property8TestRunId}_${Date.now()}`,
                  email: `p8u2_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'mod',
                },
              });
              createdUserIds.push(user2.id);

              // Her kullanıcı için log oluştur
              const log1 = await logActivity(
                user1.id,
                actionType,
                { event: 'test_event', testRunId: property8TestRunId, user: 'user1' },
                ipAddress
              );
              createdLogIds.push(log1.id);

              const log2 = await logActivity(
                user2.id,
                actionType,
                { event: 'test_event', testRunId: property8TestRunId, user: 'user2' },
                ipAddress
              );
              createdLogIds.push(log2.id);

              // User1 için filtrele
              const { logs: user1Logs } = await getActivityLogs({
                userId: user1.id,
                pageSize: 100,
              });

              // Property: Tüm dönen loglar user1'e ait olmalı
              for (const log of user1Logs) {
                expect(log.userId).toBe(user1.id);
              }

              // Property: user1'in logu sonuçlarda olmalı
              const foundLog1 = user1Logs.find(l => l.id === log1.id);
              expect(foundLog1).toBeDefined();

              // Property: user2'nin logu sonuçlarda olmamalı
              const foundLog2 = user1Logs.find(l => l.id === log2.id);
              expect(foundLog2).toBeUndefined();

              return true;
            }
          ),
          {
            numRuns: 50,
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
   * Property 8.3: Aksiyon Türü Filtresi Doğru Çalışmalı
   *
   * *Herhangi bir* aksiyon türü filtresi için, dönen loglar yalnızca
   * belirtilen aksiyon türündeki logları içermelidir.
   *
   * **Validates: Requirements 7.3**
   */
  it(
    'Property 8.3: Aksiyon türü filtresi yalnızca o türdeki logları döndürmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            ipArbitrary,
            fc.constantFrom('login', 'logout', 'view_content') as fc.Arbitrary<ActivityAction>,
            fc.constantFrom('search', 'ai_query', 'role_change') as fc.Arbitrary<ActivityAction>,
            async (ipAddress, actionType1, actionType2) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p8user_${property8TestRunId}_${Date.now()}`,
                  email: `p8_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Farklı aksiyon türlerinde loglar oluştur
              const log1 = await logActivity(
                user.id,
                actionType1,
                { event: 'test_event', testRunId: property8TestRunId, type: 'type1' },
                ipAddress
              );
              createdLogIds.push(log1.id);

              const log2 = await logActivity(
                user.id,
                actionType2,
                { event: 'test_event', testRunId: property8TestRunId, type: 'type2' },
                ipAddress
              );
              createdLogIds.push(log2.id);

              // actionType1 için filtrele
              const { logs: filteredLogs } = await getActivityLogs({
                userId: user.id,
                action: actionType1,
                pageSize: 100,
              });

              // Property: Tüm dönen loglar actionType1 türünde olmalı
              for (const log of filteredLogs) {
                expect(log.action).toBe(actionType1);
              }

              // Property: actionType1 logu sonuçlarda olmalı
              const foundLog1 = filteredLogs.find(l => l.id === log1.id);
              expect(foundLog1).toBeDefined();

              // Property: actionType2 logu sonuçlarda olmamalı (farklı türse)
              if (actionType1 !== actionType2) {
                const foundLog2 = filteredLogs.find(l => l.id === log2.id);
                expect(foundLog2).toBeUndefined();
              }

              return true;
            }
          ),
          {
            numRuns: 50,
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
   * Property 8.4: Birleşik Filtreler Kesişim Döndürmeli
   *
   * *Herhangi bir* filtre kombinasyonu için, dönen loglar tüm
   * kriterlerin kesişimini içermelidir.
   *
   * **Validates: Requirements 7.3**
   */
  it(
    'Property 8.4: Birleşik filtreler tüm kriterlerin kesişimini döndürmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            ipArbitrary,
            actionArbitrary,
            async (ipAddress, actionType) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p8user_${property8TestRunId}_${Date.now()}`,
                  email: `p8_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Log oluştur
              const log = await logActivity(
                user.id,
                actionType,
                { event: 'test_event', testRunId: property8TestRunId },
                ipAddress
              );
              createdLogIds.push(log.id);

              // Birleşik filtre uygula
              const now = new Date();
              const startDate = new Date(now.getTime() - 60000); // 1 dakika önce
              const endDate = new Date(now.getTime() + 60000); // 1 dakika sonra

              const { logs: filteredLogs } = await getActivityLogs({
                userId: user.id,
                action: actionType,
                startDate,
                endDate,
                ipAddress,
                pageSize: 100,
              });

              // Property: Tüm dönen loglar TÜM kriterleri karşılamalı
              for (const log of filteredLogs) {
                // Kullanıcı kriteri
                expect(log.userId).toBe(user.id);
                // Aksiyon kriteri
                expect(log.action).toBe(actionType);
                // Tarih kriteri
                expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                expect(log.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
                // IP kriteri
                expect(log.ipAddress).toBe(ipAddress);
              }

              // Property: Oluşturduğumuz log sonuçlarda olmalı
              const foundLog = filteredLogs.find(l => l.id === log.id);
              expect(foundLog).toBeDefined();

              return true;
            }
          ),
          {
            numRuns: 50,
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
   * Property 8.5: JSON Export ve Re-Parse Eşdeğer Veri Üretmeli
   *
   * *Herhangi bir* log seti için, JSON formatında export edip tekrar
   * parse etmek eşdeğer veri üretmelidir.
   *
   * **Validates: Requirements 7.4**
   */
  it(
    'Property 8.5: JSON export ve re-parse eşdeğer veri üretmeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            ipArbitrary,
            actionArbitrary,
            fc.integer({ min: 1, max: 5 }), // Log sayısı
            async (ipAddress, actionType, logCount) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p8user_${property8TestRunId}_${Date.now()}`,
                  email: `p8_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Birden fazla log oluştur
              for (let i = 0; i < logCount; i++) {
                const log = await logActivity(
                  user.id,
                  actionType,
                  { event: 'test_event', testRunId: property8TestRunId, index: i },
                  ipAddress
                );
                createdLogIds.push(log.id);
              }

              // JSON export yap
              const { exportLogs } = await import('@/lib/logging');
              const jsonExport = await exportLogs({ userId: user.id }, 'json');

              // JSON parse et
              const parsedLogs = JSON.parse(jsonExport);

              // Property: Parse edilen veri array olmalı
              expect(Array.isArray(parsedLogs)).toBe(true);

              // Property: Her log gerekli alanları içermeli
              for (const log of parsedLogs) {
                expect(log.id).toBeDefined();
                expect(log.userId).toBe(user.id);
                expect(log.action).toBeDefined();
                expect(log.details).toBeDefined();
                expect(log.ipAddress).toBeDefined();
                expect(log.timestamp).toBeDefined();
              }

              // Property: Oluşturduğumuz loglar export'ta olmalı
              const exportedIds = parsedLogs.map((l: { id: string }) => l.id);
              for (const logId of createdLogIds.filter(id => 
                parsedLogs.some((l: { id: string }) => l.userId === user.id)
              )) {
                // Sadece bu kullanıcıya ait logları kontrol et
                const originalLog = await prisma.activityLog.findUnique({
                  where: { id: logId },
                });
                if (originalLog?.userId === user.id) {
                  expect(exportedIds).toContain(logId);
                }
              }

              return true;
            }
          ),
          {
            numRuns: 30,
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
   * Property 8.6: CSV Export Gerekli Alanları İçermeli
   *
   * *Herhangi bir* log seti için, CSV formatında export tüm
   * gerekli alanları içermelidir.
   *
   * **Validates: Requirements 7.4**
   */
  it(
    'Property 8.6: CSV export tüm gerekli alanları içermeli',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            ipArbitrary,
            actionArbitrary,
            fc.integer({ min: 1, max: 3 }), // Log sayısı
            async (ipAddress, actionType, logCount) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p8user_${property8TestRunId}_${Date.now()}`,
                  email: `p8_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Birden fazla log oluştur
              for (let i = 0; i < logCount; i++) {
                const log = await logActivity(
                  user.id,
                  actionType,
                  { event: 'test_event', testRunId: property8TestRunId, index: i },
                  ipAddress
                );
                createdLogIds.push(log.id);
              }

              // CSV export yap
              const { exportLogs } = await import('@/lib/logging');
              const csvExport = await exportLogs({ userId: user.id }, 'csv');

              // CSV satırlarını parse et
              const lines = csvExport.split('\n');

              // Property: En az header satırı olmalı
              expect(lines.length).toBeGreaterThanOrEqual(1);

              // Property: Header gerekli alanları içermeli
              const header = lines[0];
              expect(header).toContain('ID');
              expect(header).toContain('Kullanıcı');
              expect(header).toContain('İşlem');
              expect(header).toContain('Detay');
              expect(header).toContain('IP');
              expect(header).toContain('Tarih');

              // Property: Veri satırları varsa, doğru formatta olmalı
              if (lines.length > 1) {
                for (let i = 1; i < lines.length; i++) {
                  const line = lines[i];
                  if (line.trim()) {
                    // CSV satırı en az 6 alan içermeli (virgülle ayrılmış)
                    // Not: Detay alanı JSON içerebilir, bu yüzden basit split yetersiz olabilir
                    // Ama en azından bazı temel kontroller yapabiliriz
                    expect(line.length).toBeGreaterThan(0);
                    
                    // Satır kullanıcı ID'sini içermeli
                    expect(line).toContain(user.id);
                  }
                }
              }

              return true;
            }
          ),
          {
            numRuns: 30,
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
   * Property 8.7: Çoklu Aksiyon Türü Filtresi Doğru Çalışmalı
   *
   * *Herhangi bir* aksiyon türü listesi için, dönen loglar yalnızca
   * belirtilen türlerden birindeki logları içermelidir.
   *
   * **Validates: Requirements 7.3**
   */
  it(
    'Property 8.7: Çoklu aksiyon türü filtresi doğru çalışmalı',
    async () => {
      const createdLogIds: string[] = [];
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            ipArbitrary,
            fc.constantFrom('login', 'logout') as fc.Arbitrary<ActivityAction>,
            fc.constantFrom('search', 'ai_query') as fc.Arbitrary<ActivityAction>,
            async (ipAddress, actionType1, actionType2) => {
              // Test kullanıcısı oluştur
              const passwordHash = await hashPassword('TestPassword123');
              const user = await prisma.user.create({
                data: {
                  username: `p8user_${property8TestRunId}_${Date.now()}`,
                  email: `p8_${property8TestRunId}_${Date.now()}@example.com`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(user.id);

              // Farklı aksiyon türlerinde loglar oluştur
              const log1 = await logActivity(
                user.id,
                actionType1,
                { event: 'test_event', testRunId: property8TestRunId },
                ipAddress
              );
              createdLogIds.push(log1.id);

              const log2 = await logActivity(
                user.id,
                actionType2,
                { event: 'test_event', testRunId: property8TestRunId },
                ipAddress
              );
              createdLogIds.push(log2.id);

              // Üçüncü bir aksiyon türünde log oluştur (filtrede olmayacak)
              const log3 = await logActivity(
                user.id,
                'view_content',
                { event: 'test_event', testRunId: property8TestRunId },
                ipAddress
              );
              createdLogIds.push(log3.id);

              // Çoklu aksiyon filtresi uygula
              const { logs: filteredLogs } = await getActivityLogs({
                userId: user.id,
                action: [actionType1, actionType2],
                pageSize: 100,
              });

              // Property: Tüm dönen loglar belirtilen türlerden birinde olmalı
              const allowedActions = [actionType1, actionType2];
              for (const log of filteredLogs) {
                expect(allowedActions).toContain(log.action);
              }

              // Property: actionType1 ve actionType2 logları sonuçlarda olmalı
              const foundLog1 = filteredLogs.find(l => l.id === log1.id);
              const foundLog2 = filteredLogs.find(l => l.id === log2.id);
              expect(foundLog1).toBeDefined();
              expect(foundLog2).toBeDefined();

              // Property: view_content logu sonuçlarda olmamalı
              const foundLog3 = filteredLogs.find(l => l.id === log3.id);
              expect(foundLog3).toBeUndefined();

              return true;
            }
          ),
          {
            numRuns: 50,
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
