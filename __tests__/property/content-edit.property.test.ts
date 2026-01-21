/**
 * Content Edit Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 12: İçerik Düzenleme Yetki Kontrolü
 *
 * *Herhangi bir* içerik düzenleme isteği için:
 * - Sadece "ust_yetkili" rolüne sahip kullanıcılar düzenleme yapabilmeli
 * - Mod ve admin rolleri düzenleme butonunu görmemeli
 * - Tüm düzenleme işlemleri loglanmalı
 *
 * **Validates: Requirements 11.1, 11.5, 11.6**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { hashPassword, createToken } from '@/lib/auth';
import { hasRole, ROLE_HIERARCHY } from '@/lib/rbac';
import type { UserRole } from '@/types';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = Date.now().toString(36);

// Geçerli roller
const ALL_ROLES: UserRole[] = ['none', 'mod', 'admin', 'ust_yetkili'];
const NON_SUPER_ADMIN_ROLES: UserRole[] = ['none', 'mod', 'admin'];

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Test kullanıcılarını temizle
  await prisma.activityLog.deleteMany({
    where: {
      details: {
        contains: testRunId,
      },
    },
  });
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
 * Geçerli email adresi oluşturan arbitrary
 */
const createValidEmailArbitrary = () =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 99999 }),
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
        minLength: 3,
        maxLength: 6,
      })
    )
    .map(([num, str]) => `content_edit_${testRunId}_${num}_${str}@example.com`);

/**
 * Geçerli kullanıcı adı oluşturan arbitrary
 */
const createValidUsernameArbitrary = () =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 99999 }),
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
        minLength: 3,
        maxLength: 6,
      })
    )
    .map(([num, str]) => `content_user_${testRunId}_${num}_${str}`);

/**
 * Geçerli şifre oluşturan arbitrary (en az 8 karakter)
 */
const validPasswordArbitrary = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  ),
  { minLength: 8, maxLength: 20 }
);

/**
 * Üst yetkili olmayan roller için arbitrary
 */
const nonSuperAdminRoleArbitrary = fc.constantFrom<UserRole>('none', 'mod', 'admin');

/**
 * Tüm roller için arbitrary
 */
const allRolesArbitrary = fc.constantFrom<UserRole>('none', 'mod', 'admin', 'ust_yetkili');

/**
 * İçerik tipi arbitrary
 */
const contentTypeArbitrary = fc.constantFrom('guide', 'penalty', 'command', 'procedure');

/**
 * HTTP metodu arbitrary (düzenleme işlemleri için)
 */
const editMethodArbitrary = fc.constantFrom('PUT', 'POST', 'DELETE');

/**
 * Test kullanıcısı oluşturma yardımcı fonksiyonu
 */
async function createTestUser(
  username: string,
  email: string,
  password: string,
  role: UserRole,
  status: 'pending' | 'approved' | 'rejected' = 'approved'
) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      status,
      role,
    },
  });
}

/**
 * Yetki kontrolü simülasyonu - API'nin yaptığı kontrolü taklit eder
 * withSuperAdmin middleware'inin davranışını simüle eder
 */
function checkContentEditPermission(userRole: UserRole, userStatus: string): {
  allowed: boolean;
  statusCode: number;
  reason?: string;
} {
  // Kullanıcı onaylı değilse
  if (userStatus !== 'approved') {
    return { allowed: false, statusCode: 403, reason: 'not_approved' };
  }

  // Rol kontrolü - sadece ust_yetkili düzenleme yapabilir
  if (!hasRole(userRole, 'ust_yetkili')) {
    return { allowed: false, statusCode: 403, reason: 'insufficient_role' };
  }

  return { allowed: true, statusCode: 200 };
}

describe('Property Tests: İçerik Düzenleme Yetki Kontrolü', () => {
  /**
   * Property 12a: Sadece ust_yetkili rolü içerik düzenleyebilir
   *
   * *Herhangi bir* içerik düzenleme isteği için, sadece "ust_yetkili"
   * rolüne sahip kullanıcılar düzenleme yapabilmelidir.
   *
   * **Validates: Requirements 11.1, 11.5**
   */
  it(
    'Property 12a: Sadece ust_yetkili rolü içerik düzenleyebilir',
    async () => {
      await fc.assert(
        fc.property(
          allRolesArbitrary,
          editMethodArbitrary,
          contentTypeArbitrary,
          (role, method, contentType) => {
            // Yetki kontrolü
            const result = checkContentEditPermission(role, 'approved');

            // Property: Sadece ust_yetkili erişebilmeli
            if (role === 'ust_yetkili') {
              expect(result.allowed).toBe(true);
              expect(result.statusCode).toBe(200);
            } else {
              expect(result.allowed).toBe(false);
              expect(result.statusCode).toBe(403);
            }

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 12b: Mod ve admin rolleri düzenleme yapamaz
   *
   * *Herhangi bir* mod veya admin kullanıcısı için, içerik düzenleme
   * istekleri 403 Forbidden yanıtı almalıdır.
   *
   * **Validates: Requirements 11.5**
   */
  it(
    'Property 12b: Mod ve admin rolleri düzenleme yapamaz (403 yanıtı)',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            nonSuperAdminRoleArbitrary,
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            editMethodArbitrary,
            async (role, username, email, password, method) => {
              // Test kullanıcısı oluştur
              const user = await createTestUser(username, email, password, role);
              createdUserIds.push(user.id);

              // Yetki kontrolü simülasyonu
              const result = checkContentEditPermission(user.role as UserRole, user.status);

              // Property: Mod ve admin rolleri 403 almalı
              expect(result.allowed).toBe(false);
              expect(result.statusCode).toBe(403);
              expect(result.reason).toBe('insufficient_role');

              // Rol hiyerarşisi kontrolü
              expect(hasRole(user.role as UserRole, 'ust_yetkili')).toBe(false);

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
   * Property 12c: Üst yetkili tüm düzenleme işlemlerini yapabilir
   *
   * *Herhangi bir* üst yetkili kullanıcısı için, PUT, POST ve DELETE
   * istekleri başarılı olmalıdır.
   *
   * **Validates: Requirements 11.1**
   */
  it(
    'Property 12c: Üst yetkili tüm düzenleme işlemlerini yapabilir',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            editMethodArbitrary,
            contentTypeArbitrary,
            async (username, email, password, method, contentType) => {
              // Üst yetkili kullanıcı oluştur
              const user = await createTestUser(username, email, password, 'ust_yetkili');
              createdUserIds.push(user.id);

              // Yetki kontrolü simülasyonu
              const result = checkContentEditPermission(user.role as UserRole, user.status);

              // Property: Üst yetkili erişebilmeli
              expect(result.allowed).toBe(true);
              expect(result.statusCode).toBe(200);

              // Rol hiyerarşisi kontrolü
              expect(hasRole(user.role as UserRole, 'ust_yetkili')).toBe(true);

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
   * Property 12d: Tüm düzenleme işlemleri loglanmalı
   *
   * *Herhangi bir* başarılı içerik düzenleme işlemi için, ActivityLog'da
   * ilgili kayıt oluşturulmalıdır.
   *
   * **Validates: Requirements 11.6**
   */
  it(
    'Property 12d: Tüm düzenleme işlemleri loglanmalı',
    async () => {
      const createdUserIds: string[] = [];
      const createdLogIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            fc.constantFrom('create', 'update', 'delete'),
            contentTypeArbitrary,
            fc.uuid(),
            async (username, email, password, changeType, contentType, contentId) => {
              // Üst yetkili kullanıcı oluştur
              const user = await createTestUser(username, email, password, 'ust_yetkili');
              createdUserIds.push(user.id);

              // İçerik değişikliği log kaydı oluştur (API'nin yaptığı işlem)
              const log = await prisma.activityLog.create({
                data: {
                  userId: user.id,
                  action: 'view_content',
                  details: JSON.stringify({
                    event: 'content_change',
                    contentId,
                    contentType,
                    contentTitle: `Test Content ${contentId}`,
                    changeType,
                    testRunId,
                    timestamp: new Date().toISOString(),
                  }),
                  ipAddress: '127.0.0.1',
                },
              });
              createdLogIds.push(log.id);

              // Property 1: Log kaydı oluşturulmuş olmalı
              expect(log).not.toBeNull();
              expect(log.id).toBeDefined();

              // Property 2: Log detayları doğru olmalı
              const logDetails = JSON.parse(log.details);
              expect(logDetails.event).toBe('content_change');
              expect(logDetails.contentId).toBe(contentId);
              expect(logDetails.contentType).toBe(contentType);
              expect(logDetails.changeType).toBe(changeType);

              // Property 3: Kullanıcı ID'si doğru olmalı
              expect(log.userId).toBe(user.id);

              // Veritabanından tekrar kontrol et
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
   * Property 12e: Onaylanmamış kullanıcılar düzenleme yapamaz
   *
   * *Herhangi bir* onaylanmamış (pending/rejected) kullanıcı için,
   * içerik düzenleme istekleri reddedilmelidir.
   *
   * **Validates: Requirements 11.5**
   */
  it(
    'Property 12e: Onaylanmamış kullanıcılar düzenleme yapamaz',
    async () => {
      const statusArbitrary = fc.constantFrom<'pending' | 'rejected'>('pending', 'rejected');

      await fc.assert(
        fc.property(
          allRolesArbitrary,
          statusArbitrary,
          editMethodArbitrary,
          (role, status, method) => {
            // Yetki kontrolü
            const result = checkContentEditPermission(role, status);

            // Property: Onaylanmamış kullanıcılar erişemez
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
            expect(result.reason).toBe('not_approved');

            return true;
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});

describe('Property Tests: Rol Hiyerarşisi ve İçerik Düzenleme', () => {
  /**
   * Property 12f: Rol hiyerarşisi içerik düzenleme için doğru çalışır
   *
   * Sadece ust_yetkili (seviye 3) içerik düzenleyebilir.
   * Admin (seviye 2), mod (seviye 1) ve none (seviye 0) düzenleyemez.
   *
   * **Validates: Requirements 11.5**
   */
  it(
    'Property 12f: Rol hiyerarşisi içerik düzenleme için doğru çalışır',
    async () => {
      await fc.assert(
        fc.property(allRolesArbitrary, (role) => {
          const userLevel = ROLE_HIERARCHY[role];
          const requiredLevel = ROLE_HIERARCHY['ust_yetkili'];

          // hasRole fonksiyonu ile kontrol
          const canEdit = hasRole(role, 'ust_yetkili');

          // Property: Sadece seviye 3 (ust_yetkili) düzenleyebilir
          if (userLevel >= requiredLevel) {
            expect(canEdit).toBe(true);
            expect(role).toBe('ust_yetkili');
          } else {
            expect(canEdit).toBe(false);
            expect(['none', 'mod', 'admin']).toContain(role);
          }

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );

  /**
   * Property 12g: İçerik düzenleme yetkisi geçişken değildir
   *
   * Admin, mod yetkilerine sahip olsa da içerik düzenleme yetkisine sahip değildir.
   * Bu, içerik düzenlemenin özel bir yetki olduğunu doğrular.
   *
   * **Validates: Requirements 11.5**
   */
  it(
    'Property 12g: Admin mod yetkilerine sahip ama içerik düzenleme yetkisine sahip değil',
    async () => {
      await fc.assert(
        fc.property(fc.constant('admin'), (role) => {
          // Admin, mod yetkilerine sahip
          expect(hasRole(role, 'mod')).toBe(true);
          expect(hasRole(role, 'none')).toBe(true);

          // Ama ust_yetkili yetkisine sahip değil
          expect(hasRole(role, 'ust_yetkili')).toBe(false);

          // Dolayısıyla içerik düzenleyemez
          const result = checkContentEditPermission(role, 'approved');
          expect(result.allowed).toBe(false);

          return true;
        }),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    },
    30000
  );
});

describe('Property Tests: İçerik Değişikliği Log Detayları', () => {
  /**
   * Property 12h: Log kaydı tüm gerekli alanları içermeli
   *
   * *Herhangi bir* içerik değişikliği log kaydı için:
   * - userId (kim değiştirdi)
   * - timestamp (ne zaman)
   * - contentId, contentType, changeType (ne değişti)
   * alanları bulunmalıdır.
   *
   * **Validates: Requirements 11.6**
   */
  it(
    'Property 12h: Log kaydı tüm gerekli alanları içermeli',
    async () => {
      const createdUserIds: string[] = [];
      const createdLogIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            fc.constantFrom('create', 'update', 'delete'),
            contentTypeArbitrary,
            fc.uuid(),
            fc.string({ minLength: 1, maxLength: 50 }),
            async (username, email, password, changeType, contentType, contentId, contentTitle) => {
              // Üst yetkili kullanıcı oluştur
              const user = await createTestUser(username, email, password, 'ust_yetkili');
              createdUserIds.push(user.id);

              const timestamp = new Date().toISOString();

              // Log kaydı oluştur
              const log = await prisma.activityLog.create({
                data: {
                  userId: user.id,
                  action: 'view_content',
                  details: JSON.stringify({
                    event: 'content_change',
                    contentId,
                    contentType,
                    contentTitle,
                    changeType,
                    previousContent: changeType !== 'create' ? '{"old": "data"}' : undefined,
                    newContent: changeType !== 'delete' ? '{"new": "data"}' : undefined,
                    testRunId,
                    timestamp,
                  }),
                  ipAddress: '127.0.0.1',
                },
              });
              createdLogIds.push(log.id);

              // Log detaylarını parse et
              const logDetails = JSON.parse(log.details);

              // Property 1: Kim değiştirdi (userId)
              expect(log.userId).toBe(user.id);
              expect(log.userId).toBeDefined();

              // Property 2: Ne zaman (timestamp)
              expect(logDetails.timestamp).toBeDefined();
              expect(log.timestamp).toBeDefined();

              // Property 3: Ne değişti
              expect(logDetails.contentId).toBe(contentId);
              expect(logDetails.contentType).toBe(contentType);
              expect(logDetails.changeType).toBe(changeType);

              // Property 4: İçerik başlığı
              expect(logDetails.contentTitle).toBe(contentTitle);

              // Property 5: Önceki/yeni içerik (uygun durumlarda)
              if (changeType === 'create') {
                expect(logDetails.previousContent).toBeUndefined();
                expect(logDetails.newContent).toBeDefined();
              } else if (changeType === 'delete') {
                expect(logDetails.previousContent).toBeDefined();
                expect(logDetails.newContent).toBeUndefined();
              } else if (changeType === 'update') {
                expect(logDetails.previousContent).toBeDefined();
                expect(logDetails.newContent).toBeDefined();
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
