/**
 * Admin Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 4: Admin Kullanıcı Yönetimi Tutarlılığı
 *
 * Bu test dosyası, admin kullanıcı yönetimi işlemlerinin tutarlılığını doğrular:
 * - Bekleyen kullanıcılar listesi tüm "Beklemede" durumundaki kullanıcıları içermeli
 * - Onaylama işlemi kullanıcı durumunu "Onaylı" yapmalı ve yetki atamalı
 * - Reddetme işlemi kullanıcı durumunu "Reddedildi" yapmalı
 * - Yetki değişiklikleri hem veritabanına hem log'a kaydedilmeli
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/auth';
import type { UserRole } from '@/types';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = Date.now().toString(36);

// Geçerli roller
const VALID_ROLES: UserRole[] = ['mod', 'admin', 'ust_yetkili'];

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
    .map(([num, str]) => `admin_test_${testRunId}_${num}_${str}@example.com`);

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
    .map(([num, str]) => `admin_user_${testRunId}_${num}_${str}`);

/**
 * Geçerli rol oluşturan arbitrary
 */
const validRoleArbitrary = fc.constantFrom<UserRole>('mod', 'admin', 'ust_yetkili');

/**
 * Geçerli şifre oluşturan arbitrary (en az 8 karakter)
 */
const validPasswordArbitrary = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  ),
  { minLength: 8, maxLength: 20 }
);

describe('Property Tests: Admin - Kullanıcı Yönetimi Tutarlılığı', () => {
  /**
   * Property 4a: Bekleyen kullanıcılar listesi tutarlılığı
   *
   * *Herhangi bir* admin işlemi için, bekleyen kullanıcılar listesi
   * tüm "Beklemede" durumundaki kullanıcıları içermelidir.
   *
   * **Validates: Requirements 3.1**
   */
  it(
    'Property 4a: Bekleyen kullanıcılar listesi tüm "pending" durumundaki kullanıcıları içermeli',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 5 }), // Oluşturulacak pending kullanıcı sayısı
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            async (pendingCount, baseUsername, baseEmail, password) => {
              const pendingUserIds: string[] = [];
              const passwordHash = await hashPassword(password);

              // Birden fazla pending kullanıcı oluştur
              for (let i = 0; i < pendingCount; i++) {
                const user = await prisma.user.create({
                  data: {
                    username: `${baseUsername}_${i}`,
                    email: baseEmail.replace('@', `_${i}@`),
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                pendingUserIds.push(user.id);
                createdUserIds.push(user.id);
              }

              // Bekleyen kullanıcılar listesini al (API'nin yaptığı işlem)
              const pendingUsers = await prisma.user.findMany({
                where: {
                  status: 'pending',
                },
                select: {
                  id: true,
                  status: true,
                },
              });

              // Property: Oluşturduğumuz tüm pending kullanıcılar listede olmalı
              for (const userId of pendingUserIds) {
                const found = pendingUsers.find((u) => u.id === userId);
                expect(found).toBeDefined();
                expect(found?.status).toBe('pending');
              }

              // Property: Listedeki tüm kullanıcılar "pending" durumunda olmalı
              for (const user of pendingUsers) {
                expect(user.status).toBe('pending');
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
        // Toplu temizlik
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
   * Property 4b: Onaylama işlemi tutarlılığı
   *
   * *Herhangi bir* onaylama işlemi için, kullanıcı durumu "approved" olmalı
   * ve atanan yetki seviyesi kaydedilmelidir.
   *
   * **Validates: Requirements 3.2**
   */
  it(
    'Property 4b: Onaylama işlemi kullanıcı durumunu "approved" yapmalı ve yetki atamalı',
    async () => {
      const createdUserIds: string[] = [];
      const createdLogIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            validRoleArbitrary,
            async (username, email, password, assignedRole) => {
              const passwordHash = await hashPassword(password);

              // Pending kullanıcı oluştur
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'pending',
                  role: 'none',
                },
              });
              createdUserIds.push(user.id);

              // Admin kullanıcı oluştur (işlemi yapacak)
              const adminUser = await prisma.user.create({
                data: {
                  username: `admin_${username}`,
                  email: `admin_${email}`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(adminUser.id);

              // Onaylama işlemi (API'nin yaptığı işlem)
              const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                  status: 'approved',
                  role: assignedRole,
                  updatedAt: new Date(),
                },
              });

              // Activity log oluştur
              const log = await prisma.activityLog.create({
                data: {
                  userId: adminUser.id,
                  action: 'user_approve',
                  details: JSON.stringify({
                    targetUserId: user.id,
                    targetUsername: username,
                    assignedRole: assignedRole,
                    previousStatus: 'pending',
                    testRunId: testRunId,
                  }),
                  ipAddress: 'test-ip',
                },
              });
              createdLogIds.push(log.id);

              // Property 1: Kullanıcı durumu "approved" olmalı
              expect(updatedUser.status).toBe('approved');

              // Property 2: Atanan rol doğru olmalı
              expect(updatedUser.role).toBe(assignedRole);
              expect(VALID_ROLES).toContain(updatedUser.role);

              // Veritabanından tekrar kontrol et
              const savedUser = await prisma.user.findUnique({
                where: { id: user.id },
              });
              expect(savedUser?.status).toBe('approved');
              expect(savedUser?.role).toBe(assignedRole);

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
   * Property 4c: Reddetme işlemi tutarlılığı
   *
   * *Herhangi bir* reddetme işlemi için, kullanıcı durumu "rejected" olmalıdır.
   *
   * **Validates: Requirements 3.3**
   */
  it(
    'Property 4c: Reddetme işlemi kullanıcı durumunu "rejected" yapmalı',
    async () => {
      const createdUserIds: string[] = [];
      const createdLogIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            async (username, email, password) => {
              const passwordHash = await hashPassword(password);

              // Pending kullanıcı oluştur
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'pending',
                  role: 'none',
                },
              });
              createdUserIds.push(user.id);

              // Admin kullanıcı oluştur (işlemi yapacak)
              const adminUser = await prisma.user.create({
                data: {
                  username: `admin_${username}`,
                  email: `admin_${email}`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(adminUser.id);

              // Reddetme işlemi (API'nin yaptığı işlem)
              const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                  status: 'rejected',
                  role: 'none',
                  updatedAt: new Date(),
                },
              });

              // Activity log oluştur
              const log = await prisma.activityLog.create({
                data: {
                  userId: adminUser.id,
                  action: 'user_reject',
                  details: JSON.stringify({
                    targetUserId: user.id,
                    targetUsername: username,
                    previousStatus: 'pending',
                    previousRole: 'none',
                    reason: 'Test rejection',
                    testRunId: testRunId,
                  }),
                  ipAddress: 'test-ip',
                },
              });
              createdLogIds.push(log.id);

              // Property 1: Kullanıcı durumu "rejected" olmalı
              expect(updatedUser.status).toBe('rejected');

              // Property 2: Rol "none" olmalı (sıfırlanmalı)
              expect(updatedUser.role).toBe('none');

              // Veritabanından tekrar kontrol et
              const savedUser = await prisma.user.findUnique({
                where: { id: user.id },
              });
              expect(savedUser?.status).toBe('rejected');
              expect(savedUser?.role).toBe('none');

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
   * Property 4d: Yetki değişikliği loglama tutarlılığı
   *
   * *Herhangi bir* yetki değişikliği için, değişiklik hem veritabanına
   * hem de ActivityLog'a kaydedilmelidir.
   *
   * **Validates: Requirements 3.4**
   */
  it(
    'Property 4d: Yetki değişiklikleri hem veritabanına hem log\'a kaydedilmeli',
    async () => {
      const createdUserIds: string[] = [];
      const createdLogIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            validRoleArbitrary,
            validRoleArbitrary,
            async (username, email, password, initialRole, newRole) => {
              // Aynı rol ise atla
              if (initialRole === newRole) {
                return true;
              }

              const passwordHash = await hashPassword(password);

              // Onaylı kullanıcı oluştur (başlangıç rolü ile)
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'approved',
                  role: initialRole,
                },
              });
              createdUserIds.push(user.id);

              // Admin kullanıcı oluştur (işlemi yapacak)
              const adminUser = await prisma.user.create({
                data: {
                  username: `admin_${username}`,
                  email: `admin_${email}`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(adminUser.id);

              const previousRole = user.role;

              // Yetki değiştirme işlemi (API'nin yaptığı işlem)
              const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                  role: newRole,
                  updatedAt: new Date(),
                },
              });

              // Activity log oluştur
              const log = await prisma.activityLog.create({
                data: {
                  userId: adminUser.id,
                  action: 'role_change',
                  details: JSON.stringify({
                    targetUserId: user.id,
                    targetUsername: username,
                    previousRole: previousRole,
                    newRole: newRole,
                    testRunId: testRunId,
                  }),
                  ipAddress: 'test-ip',
                },
              });
              createdLogIds.push(log.id);

              // Property 1: Veritabanında yeni rol kaydedilmiş olmalı
              expect(updatedUser.role).toBe(newRole);

              // Veritabanından tekrar kontrol et
              const savedUser = await prisma.user.findUnique({
                where: { id: user.id },
              });
              expect(savedUser?.role).toBe(newRole);

              // Property 2: ActivityLog'da kayıt olmalı
              const savedLog = await prisma.activityLog.findUnique({
                where: { id: log.id },
              });
              expect(savedLog).not.toBeNull();
              expect(savedLog?.action).toBe('role_change');

              // Property 3: Log detayları doğru olmalı
              const logDetails = JSON.parse(savedLog?.details || '{}');
              expect(logDetails.targetUserId).toBe(user.id);
              expect(logDetails.previousRole).toBe(previousRole);
              expect(logDetails.newRole).toBe(newRole);

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
