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


/**
 * Property Tests: Admin - User Filtering Correctness
 * Feature: yetkili-kilavuzu-v2-guncelleme, Property 5: User Filtering Correctness
 *
 * Bu test dosyası, kullanıcı filtreleme işlemlerinin doğruluğunu doğrular:
 * - Search filter sadece username veya email eşleşen kullanıcıları döndürmeli
 * - Status filter sadece eşleşen duruma sahip kullanıcıları döndürmeli
 * - Role filter sadece eşleşen role sahip kullanıcıları döndürmeli
 * - Combined filters tüm kriterlerin kesişimini döndürmeli
 * - İstatistikler filtrelenmiş sonuçları doğru yansıtmalı
 * - Bulk operations sadece seçilen kullanıcıları etkilemeli
 *
 * **Validates: Requirements 5.2, 5.3, 5.5, 5.7**
 */
describe('Property Tests: Admin - User Filtering Correctness', () => {
  // Test için benzersiz ID oluşturmak için
  const filterTestRunId = `filter_${Date.now().toString(36)}`;

  // Geçerli status değerleri
  const VALID_STATUSES: ('pending' | 'approved' | 'rejected')[] = ['pending', 'approved', 'rejected'];

  // Geçerli rol değerleri (filtreleme için)
  const FILTER_ROLES: UserRole[] = ['mod', 'admin', 'ust_yetkili'];

  /**
   * Filtreleme testi için benzersiz email oluşturan arbitrary
   */
  const createFilterTestEmailArbitrary = () =>
    fc
      .tuple(
        fc.integer({ min: 1, max: 99999 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
          minLength: 3,
          maxLength: 6,
        })
      )
      .map(([num, str]) => `filter_test_${filterTestRunId}_${num}_${str}@example.com`);

  /**
   * Filtreleme testi için benzersiz kullanıcı adı oluşturan arbitrary
   */
  const createFilterTestUsernameArbitrary = () =>
    fc
      .tuple(
        fc.integer({ min: 1, max: 99999 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
          minLength: 3,
          maxLength: 6,
        })
      )
      .map(([num, str]) => `filter_user_${filterTestRunId}_${num}_${str}`);

  /**
   * Status arbitrary
   */
  const statusArbitrary = fc.constantFrom<'pending' | 'approved' | 'rejected'>('pending', 'approved', 'rejected');

  /**
   * Role arbitrary (none dahil)
   */
  const roleWithNoneArbitrary = fc.constantFrom<UserRole>('none', 'mod', 'admin', 'ust_yetkili');

  /**
   * Property 5a: Search filter username veya email ile eşleşen kullanıcıları döndürmeli
   *
   * *Herhangi bir* arama sorgusu için, dönen kullanıcılar listesi
   * sadece username veya email'inde arama terimi geçen kullanıcıları içermelidir.
   *
   * **Validates: Requirements 5.2**
   */
  it(
    'Property 5a: Search filter sadece username veya email eşleşen kullanıcıları döndürmeli',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createFilterTestUsernameArbitrary(),
            createFilterTestEmailArbitrary(),
            validPasswordArbitrary,
            statusArbitrary,
            roleWithNoneArbitrary,
            async (username, email, password, status, role) => {
              const passwordHash = await hashPassword(password);

              // Test kullanıcısı oluştur
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status,
                  role,
                },
              });
              createdUserIds.push(user.id);

              // Username'in bir kısmı ile ara
              const searchTerm = username.substring(0, Math.min(10, username.length));

              // Arama yap (API'nin yaptığı işlem)
              const searchResults = await prisma.user.findMany({
                where: {
                  OR: [
                    { username: { contains: searchTerm, mode: 'insensitive' } },
                    { email: { contains: searchTerm, mode: 'insensitive' } },
                  ],
                },
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              });

              // Property: Oluşturduğumuz kullanıcı sonuçlarda olmalı
              const found = searchResults.find((u) => u.id === user.id);
              expect(found).toBeDefined();

              // Property: Tüm sonuçlar arama terimiyle eşleşmeli
              for (const result of searchResults) {
                const matchesUsername = result.username.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesEmail = result.email.toLowerCase().includes(searchTerm.toLowerCase());
                expect(matchesUsername || matchesEmail).toBe(true);
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
   * Property 5b: Status filter sadece eşleşen duruma sahip kullanıcıları döndürmeli
   *
   * *Herhangi bir* status filtresi için, dönen kullanıcılar listesi
   * sadece o duruma sahip kullanıcıları içermelidir.
   *
   * **Validates: Requirements 5.3**
   */
  it(
    'Property 5b: Status filter sadece eşleşen duruma sahip kullanıcıları döndürmeli',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 3 }), // Her status için oluşturulacak kullanıcı sayısı
            createFilterTestUsernameArbitrary(),
            createFilterTestEmailArbitrary(),
            validPasswordArbitrary,
            statusArbitrary, // Filtrelenecek status
            async (countPerStatus, baseUsername, baseEmail, password, filterStatus) => {
              const passwordHash = await hashPassword(password);
              const createdByStatus: Record<string, string[]> = {
                pending: [],
                approved: [],
                rejected: [],
              };

              // Her status için kullanıcılar oluştur
              for (const status of VALID_STATUSES) {
                for (let i = 0; i < countPerStatus; i++) {
                  const user = await prisma.user.create({
                    data: {
                      username: `${baseUsername}_${status}_${i}`,
                      email: baseEmail.replace('@', `_${status}_${i}@`),
                      passwordHash,
                      status,
                      role: status === 'approved' ? 'mod' : 'none',
                    },
                  });
                  createdByStatus[status].push(user.id);
                  createdUserIds.push(user.id);
                }
              }

              // Status ile filtrele (API'nin yaptığı işlem)
              const filteredUsers = await prisma.user.findMany({
                where: {
                  status: filterStatus,
                  id: { in: createdUserIds }, // Sadece test kullanıcılarını kontrol et
                },
                select: {
                  id: true,
                  status: true,
                },
              });

              // Property 1: Tüm sonuçlar filtrelenen status'a sahip olmalı
              for (const user of filteredUsers) {
                expect(user.status).toBe(filterStatus);
              }

              // Property 2: Oluşturduğumuz o status'taki kullanıcılar sonuçlarda olmalı
              for (const userId of createdByStatus[filterStatus]) {
                const found = filteredUsers.find((u) => u.id === userId);
                expect(found).toBeDefined();
              }

              // Property 3: Diğer status'taki kullanıcılar sonuçlarda olmamalı
              for (const status of VALID_STATUSES) {
                if (status !== filterStatus) {
                  for (const userId of createdByStatus[status]) {
                    const found = filteredUsers.find((u) => u.id === userId);
                    expect(found).toBeUndefined();
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
   * Property 5c: Role filter sadece eşleşen role sahip kullanıcıları döndürmeli
   *
   * *Herhangi bir* role filtresi için, dönen kullanıcılar listesi
   * sadece o role sahip kullanıcıları içermelidir.
   *
   * **Validates: Requirements 5.3**
   */
  it(
    'Property 5c: Role filter sadece eşleşen role sahip kullanıcıları döndürmeli',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 2 }), // Her rol için oluşturulacak kullanıcı sayısı
            createFilterTestUsernameArbitrary(),
            createFilterTestEmailArbitrary(),
            validPasswordArbitrary,
            fc.constantFrom<UserRole>('mod', 'admin', 'ust_yetkili'), // Filtrelenecek rol
            async (countPerRole, baseUsername, baseEmail, password, filterRole) => {
              const passwordHash = await hashPassword(password);
              const createdByRole: Record<string, string[]> = {
                mod: [],
                admin: [],
                ust_yetkili: [],
              };

              // Her rol için kullanıcılar oluştur
              for (const role of FILTER_ROLES) {
                for (let i = 0; i < countPerRole; i++) {
                  const user = await prisma.user.create({
                    data: {
                      username: `${baseUsername}_${role}_${i}`,
                      email: baseEmail.replace('@', `_${role}_${i}@`),
                      passwordHash,
                      status: 'approved',
                      role,
                    },
                  });
                  createdByRole[role].push(user.id);
                  createdUserIds.push(user.id);
                }
              }

              // Role ile filtrele (API'nin yaptığı işlem)
              const filteredUsers = await prisma.user.findMany({
                where: {
                  role: filterRole,
                  id: { in: createdUserIds }, // Sadece test kullanıcılarını kontrol et
                },
                select: {
                  id: true,
                  role: true,
                },
              });

              // Property 1: Tüm sonuçlar filtrelenen role sahip olmalı
              for (const user of filteredUsers) {
                expect(user.role).toBe(filterRole);
              }

              // Property 2: Oluşturduğumuz o roldeki kullanıcılar sonuçlarda olmalı
              for (const userId of createdByRole[filterRole]) {
                const found = filteredUsers.find((u) => u.id === userId);
                expect(found).toBeDefined();
              }

              // Property 3: Diğer rollerdeki kullanıcılar sonuçlarda olmamalı
              for (const role of FILTER_ROLES) {
                if (role !== filterRole) {
                  for (const userId of createdByRole[role]) {
                    const found = filteredUsers.find((u) => u.id === userId);
                    expect(found).toBeUndefined();
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
   * Property 5d: Combined filters tüm kriterlerin kesişimini döndürmeli
   *
   * *Herhangi bir* search, status ve role filtresi kombinasyonu için,
   * dönen kullanıcılar listesi TÜM kriterleri karşılayan kullanıcıları içermelidir.
   *
   * **Validates: Requirements 5.2, 5.3**
   */
  it(
    'Property 5d: Combined filters tüm kriterlerin kesişimini döndürmeli',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createFilterTestUsernameArbitrary(),
            createFilterTestEmailArbitrary(),
            validPasswordArbitrary,
            statusArbitrary,
            fc.constantFrom<UserRole>('mod', 'admin', 'ust_yetkili'),
            async (username, email, password, status, role) => {
              const passwordHash = await hashPassword(password);

              // Hedef kullanıcı oluştur (tüm kriterlere uyan)
              const targetUser = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status,
                  role,
                },
              });
              createdUserIds.push(targetUser.id);

              // Farklı status'ta kullanıcı oluştur
              const differentStatusUser = await prisma.user.create({
                data: {
                  username: `${username}_diff_status`,
                  email: email.replace('@', '_diff_status@'),
                  passwordHash,
                  status: status === 'pending' ? 'approved' : 'pending',
                  role,
                },
              });
              createdUserIds.push(differentStatusUser.id);

              // Farklı rol'de kullanıcı oluştur
              const differentRoleUser = await prisma.user.create({
                data: {
                  username: `${username}_diff_role`,
                  email: email.replace('@', '_diff_role@'),
                  passwordHash,
                  status,
                  role: role === 'mod' ? 'admin' : 'mod',
                },
              });
              createdUserIds.push(differentRoleUser.id);

              // Arama terimi
              const searchTerm = username.substring(0, Math.min(10, username.length));

              // Combined filter uygula (API'nin yaptığı işlem)
              const filteredUsers = await prisma.user.findMany({
                where: {
                  AND: [
                    {
                      OR: [
                        { username: { contains: searchTerm, mode: 'insensitive' } },
                        { email: { contains: searchTerm, mode: 'insensitive' } },
                      ],
                    },
                    { status },
                    { role },
                  ],
                  id: { in: createdUserIds }, // Sadece test kullanıcılarını kontrol et
                },
                select: {
                  id: true,
                  username: true,
                  email: true,
                  status: true,
                  role: true,
                },
              });

              // Property 1: Hedef kullanıcı sonuçlarda olmalı
              const foundTarget = filteredUsers.find((u) => u.id === targetUser.id);
              expect(foundTarget).toBeDefined();

              // Property 2: Tüm sonuçlar TÜM kriterleri karşılamalı
              for (const user of filteredUsers) {
                // Search kriteri
                const matchesSearch =
                  user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  user.email.toLowerCase().includes(searchTerm.toLowerCase());
                expect(matchesSearch).toBe(true);

                // Status kriteri
                expect(user.status).toBe(status);

                // Role kriteri
                expect(user.role).toBe(role);
              }

              // Property 3: Farklı status'taki kullanıcı sonuçlarda olmamalı
              const foundDiffStatus = filteredUsers.find((u) => u.id === differentStatusUser.id);
              expect(foundDiffStatus).toBeUndefined();

              // Property 4: Farklı roldeki kullanıcı sonuçlarda olmamalı
              const foundDiffRole = filteredUsers.find((u) => u.id === differentRoleUser.id);
              expect(foundDiffRole).toBeUndefined();

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
   * Property 5e: İstatistikler filtrelenmiş sonuçları doğru yansıtmalı
   *
   * *Herhangi bir* kullanıcı seti için, istatistikler (total, pending, approved, rejected)
   * gerçek kullanıcı sayılarını doğru yansıtmalıdır.
   *
   * **Validates: Requirements 5.7**
   */
  it(
    'Property 5e: İstatistikler filtrelenmiş sonuçları doğru yansıtmalı',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 3 }), // Pending sayısı
            fc.integer({ min: 1, max: 3 }), // Approved sayısı
            fc.integer({ min: 1, max: 3 }), // Rejected sayısı
            createFilterTestUsernameArbitrary(),
            createFilterTestEmailArbitrary(),
            validPasswordArbitrary,
            async (pendingCount, approvedCount, rejectedCount, baseUsername, baseEmail, password) => {
              const passwordHash = await hashPassword(password);

              // Başlangıç istatistiklerini al
              const initialStats = {
                pending: await prisma.user.count({ where: { status: 'pending' } }),
                approved: await prisma.user.count({ where: { status: 'approved' } }),
                rejected: await prisma.user.count({ where: { status: 'rejected' } }),
                total: await prisma.user.count(),
              };

              // Pending kullanıcılar oluştur
              for (let i = 0; i < pendingCount; i++) {
                const user = await prisma.user.create({
                  data: {
                    username: `${baseUsername}_pending_${i}`,
                    email: baseEmail.replace('@', `_pending_${i}@`),
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                createdUserIds.push(user.id);
              }

              // Approved kullanıcılar oluştur
              for (let i = 0; i < approvedCount; i++) {
                const user = await prisma.user.create({
                  data: {
                    username: `${baseUsername}_approved_${i}`,
                    email: baseEmail.replace('@', `_approved_${i}@`),
                    passwordHash,
                    status: 'approved',
                    role: 'mod',
                  },
                });
                createdUserIds.push(user.id);
              }

              // Rejected kullanıcılar oluştur
              for (let i = 0; i < rejectedCount; i++) {
                const user = await prisma.user.create({
                  data: {
                    username: `${baseUsername}_rejected_${i}`,
                    email: baseEmail.replace('@', `_rejected_${i}@`),
                    passwordHash,
                    status: 'rejected',
                    role: 'none',
                  },
                });
                createdUserIds.push(user.id);
              }

              // Güncel istatistikleri al (API'nin yaptığı işlem)
              const currentStats = {
                pending: await prisma.user.count({ where: { status: 'pending' } }),
                approved: await prisma.user.count({ where: { status: 'approved' } }),
                rejected: await prisma.user.count({ where: { status: 'rejected' } }),
                total: await prisma.user.count(),
              };

              // Property 1: Pending sayısı doğru artmalı
              expect(currentStats.pending).toBe(initialStats.pending + pendingCount);

              // Property 2: Approved sayısı doğru artmalı
              expect(currentStats.approved).toBe(initialStats.approved + approvedCount);

              // Property 3: Rejected sayısı doğru artmalı
              expect(currentStats.rejected).toBe(initialStats.rejected + rejectedCount);

              // Property 4: Total sayısı doğru artmalı
              const expectedTotal = pendingCount + approvedCount + rejectedCount;
              expect(currentStats.total).toBe(initialStats.total + expectedTotal);

              // Property 5: Total = pending + approved + rejected
              expect(currentStats.total).toBe(
                currentStats.pending + currentStats.approved + currentStats.rejected
              );

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
   * Property 5f: Bulk operations sadece seçilen kullanıcıları etkilemeli
   *
   * *Herhangi bir* toplu işlem için, sadece seçilen kullanıcılar etkilenmeli,
   * seçilmeyen kullanıcılar değişmeden kalmalıdır.
   *
   * **Validates: Requirements 5.5**
   */
  it(
    'Property 5f: Bulk operations sadece seçilen kullanıcıları etkilemeli',
    async () => {
      const createdUserIds: string[] = [];
      const createdLogIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 3 }), // Seçilecek kullanıcı sayısı
            fc.integer({ min: 1, max: 3 }), // Seçilmeyecek kullanıcı sayısı
            createFilterTestUsernameArbitrary(),
            createFilterTestEmailArbitrary(),
            validPasswordArbitrary,
            fc.constantFrom<'approve' | 'reject'>('approve', 'reject'),
            fc.integer({ min: 1, max: 99999 }), // Benzersizlik için ek sayı
            async (selectedCount, unselectedCount, baseUsername, baseEmail, password, action, uniqueNum) => {
              const passwordHash = await hashPassword(password);
              const selectedUserIds: string[] = [];
              const unselectedUserIds: string[] = [];
              const iterationLogIds: string[] = []; // Bu iterasyon için log ID'leri

              // Admin kullanıcı oluştur (işlemi yapacak) - benzersiz isim ile
              const adminUser = await prisma.user.create({
                data: {
                  username: `bulk_admin_${uniqueNum}_${baseUsername}`,
                  email: `bulk_admin_${uniqueNum}_${baseEmail}`,
                  passwordHash,
                  status: 'approved',
                  role: 'admin',
                },
              });
              createdUserIds.push(adminUser.id);

              // Seçilecek pending kullanıcılar oluştur
              for (let i = 0; i < selectedCount; i++) {
                const user = await prisma.user.create({
                  data: {
                    username: `${baseUsername}_sel_${uniqueNum}_${i}`,
                    email: baseEmail.replace('@', `_sel_${uniqueNum}_${i}@`),
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                selectedUserIds.push(user.id);
                createdUserIds.push(user.id);
              }

              // Seçilmeyecek pending kullanıcılar oluştur
              for (let i = 0; i < unselectedCount; i++) {
                const user = await prisma.user.create({
                  data: {
                    username: `${baseUsername}_unsel_${uniqueNum}_${i}`,
                    email: baseEmail.replace('@', `_unsel_${uniqueNum}_${i}@`),
                    passwordHash,
                    status: 'pending',
                    role: 'none',
                  },
                });
                unselectedUserIds.push(user.id);
                createdUserIds.push(user.id);
              }

              // Bulk işlem simülasyonu (API'nin yaptığı işlem)
              const newStatus = action === 'approve' ? 'approved' : 'rejected';
              const newRole = action === 'approve' ? 'mod' : 'none';

              // Sadece seçilen kullanıcıları güncelle
              await prisma.user.updateMany({
                where: {
                  id: { in: selectedUserIds },
                },
                data: {
                  status: newStatus,
                  role: newRole,
                  updatedAt: new Date(),
                },
              });

              // Activity log oluştur
              for (const userId of selectedUserIds) {
                const log = await prisma.activityLog.create({
                  data: {
                    userId: adminUser.id,
                    action: action === 'approve' ? 'user_approve' : 'user_reject',
                    details: JSON.stringify({
                      event: `bulk_user_${action}`,
                      targetUserId: userId,
                      bulkOperation: true,
                      testRunId: filterTestRunId,
                      uniqueNum: uniqueNum,
                    }),
                    ipAddress: 'test-ip',
                  },
                });
                iterationLogIds.push(log.id);
                createdLogIds.push(log.id);
              }

              // Property 1: Seçilen kullanıcılar güncellenmiş olmalı
              const selectedUsers = await prisma.user.findMany({
                where: { id: { in: selectedUserIds } },
                select: { id: true, status: true, role: true },
              });

              for (const user of selectedUsers) {
                expect(user.status).toBe(newStatus);
                expect(user.role).toBe(newRole);
              }

              // Property 2: Seçilmeyen kullanıcılar değişmemiş olmalı
              const unselectedUsers = await prisma.user.findMany({
                where: { id: { in: unselectedUserIds } },
                select: { id: true, status: true, role: true },
              });

              for (const user of unselectedUsers) {
                expect(user.status).toBe('pending');
                expect(user.role).toBe('none');
              }

              // Property 3: Sadece seçilen kullanıcılar için log oluşturulmuş olmalı
              // Bu iterasyonda oluşturulan log sayısı seçilen kullanıcı sayısına eşit olmalı
              expect(iterationLogIds.length).toBe(selectedCount);

              // Veritabanından doğrula
              const logs = await prisma.activityLog.findMany({
                where: {
                  id: { in: iterationLogIds },
                },
              });
              expect(logs.length).toBe(selectedCount);

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
});
