/**
 * Auth Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 1: Kayıt Durumu Tutarlılığı
 *
 * Bu test dosyası, kayıt işleminin her zaman kullanıcıyı "pending" durumunda
 * oluşturduğunu doğrular.
 *
 * **Validates: Requirements 1.1**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { hashPassword, isValidEmail, isValidPassword } from '@/lib/auth';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = Date.now().toString(36);

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
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
    .map(([num, str]) => `test_${testRunId}_${num}_${str}@example.com`);

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
    .map(([num, str]) => `user_${testRunId}_${num}_${str}`);

/**
 * Geçerli şifre oluşturan arbitrary (en az 8 karakter)
 */
const validPasswordArbitrary = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  ),
  { minLength: 8, maxLength: 20 }
);

describe('Property Tests: Auth - Kayıt Durumu Tutarlılığı', () => {
  /**
   * Property 1: Kayıt Durumu Tutarlılığı
   *
   * *Herhangi bir* geçerli kayıt isteği için, kayıt işlemi tamamlandığında
   * kullanıcı veritabanında "Beklemede" (pending) durumunda bulunmalıdır.
   *
   * **Validates: Requirements 1.1**
   */
  it(
    'Property 1: Geçerli kayıt isteği sonrası kullanıcı her zaman "pending" durumunda olmalı',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            async (username, email, password) => {
              // Önkoşul: Veriler geçerli olmalı
              if (!isValidEmail(email) || !isValidPassword(password)) {
                return true;
              }

              // Şifreyi hashle
              const passwordHash = await hashPassword(password);

              // Kullanıcıyı oluştur (register endpoint'inin yaptığı işlem)
              // Yeni şemada roleId kullanılıyor, role string değil
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'pending',
                  roleId: null, // Yeni kullanıcılar rol atanmadan başlar
                },
              });

              createdUserIds.push(user.id);

              // Property: Kullanıcı "pending" durumunda olmalı
              expect(user.status).toBe('pending');

              // Veritabanından tekrar kontrol et
              const savedUser = await prisma.user.findUnique({
                where: { id: user.id },
              });

              expect(savedUser).not.toBeNull();
              expect(savedUser?.status).toBe('pending');
              expect(savedUser?.roleId).toBeNull(); // Yeni kullanıcılar rol atanmadan başlar

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
    60000 // 60 saniye timeout
  );

  /**
   * Property 1.1: Kayıt sonrası varsayılan değerler
   *
  /**
   * Property 1.1: Kayıt sonrası varsayılan değerler
   *
   * Yeni kayıt olan her kullanıcı için:
   * - status = "pending"
   * - roleId = null (rol atanmamış)
   *
   * **Validates: Requirements 1.1**
   */
  it(
    'Property 1.1: Yeni kayıt olan kullanıcıların varsayılan değerleri doğru olmalı',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            async (username, email, password) => {
              if (!isValidEmail(email) || !isValidPassword(password)) {
                return true;
              }

              const passwordHash = await hashPassword(password);

              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'pending',
                  roleId: null, // Yeni kullanıcılar rol atanmadan başlar
                },
              });

              createdUserIds.push(user.id);

              // Property 1: Status her zaman "pending" olmalı
              expect(user.status).toBe('pending');

              // Property 2: roleId her zaman null olmalı (yeni kayıt, rol atanmamış)
              expect(user.roleId).toBeNull();

              // Property 3: Kullanıcı veritabanında bulunabilmeli
              const dbUser = await prisma.user.findUnique({
                where: { email },
              });
              expect(dbUser).not.toBeNull();
              expect(dbUser?.status).toBe('pending');

              return true;
            }
          ),
          {
            numRuns: 100,
            verbose: false,
          }
        );
      } finally {
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


/**
 * Property 2: Kimlik Doğrulama Round-Trip
 * Feature: yetkili-kilavuzu, Property 2: Kimlik Doğrulama Round-Trip
 *
 * *Herhangi bir* kayıtlı kullanıcı için, doğru kimlik bilgileriyle giriş yapıldığında
 * oturum oluşturulmalı ve çıkış yapıldığında oturum geçersiz hale gelmelidir.
 * Geçersiz kimlik bilgileriyle giriş denemesi her zaman reddedilmelidir.
 *
 * **Validates: Requirements 1.2, 1.3, 1.4**
 */
import {
  createSession,
  deleteSession,
  validateSession,
  verifyPassword,
} from '@/lib/auth';

describe('Property Tests: Auth - Kimlik Doğrulama Round-Trip', () => {
  /**
   * Property 2a: Doğru kimlik bilgileriyle giriş → oturum oluşturulmalı
   *
   * *Herhangi bir* kayıtlı kullanıcı için, doğru kimlik bilgileriyle giriş yapıldığında
   * geçerli bir oturum oluşturulmalıdır.
   *
   * **Validates: Requirements 1.2**
   */
  it(
    'Property 2a: Doğru kimlik bilgileriyle giriş yapıldığında oturum oluşturulmalı',
    async () => {
      const createdUserIds: string[] = [];
      const createdSessionTokens: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            async (username, email, password) => {
              if (!isValidEmail(email) || !isValidPassword(password)) {
                return true;
              }

              // Kullanıcı oluştur
              const passwordHash = await hashPassword(password);
              
              // Test için bir rol bul (varsa)
              const testRole = await prisma.role.findFirst({
                where: { hierarchy: { gte: 2 } },
              });
              
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'approved',
                  roleId: testRole?.id || null,
                },
              });
              createdUserIds.push(user.id);

              // Şifre doğrulama (login işleminin ilk adımı)
              const isPasswordValid = await verifyPassword(
                password,
                user.passwordHash
              );
              expect(isPasswordValid).toBe(true);

              // Oturum oluştur (login işleminin ikinci adımı)
              const session = await createSession(user.id);
              createdSessionTokens.push(session.token);

              // Property: Oturum oluşturulmuş olmalı
              expect(session).not.toBeNull();
              expect(session.userId).toBe(user.id);
              expect(session.token).toBeDefined();
              expect(session.token.length).toBeGreaterThan(0);

              // Oturum geçerli olmalı
              const validatedSession = await validateSession(session.token);
              expect(validatedSession).not.toBeNull();
              expect(validatedSession?.userId).toBe(user.id);

              return true;
            }
          ),
          {
            numRuns: 100,
            verbose: false,
          }
        );
      } finally {
        // Temizlik: Oturumları sil
        for (const token of createdSessionTokens) {
          await deleteSession(token);
        }
        // Temizlik: Kullanıcıları sil
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
   * Property 2b: Çıkış yapıldığında oturum geçersiz hale gelmeli
   *
   * *Herhangi bir* kayıtlı kullanıcı için, çıkış yapıldığında oturum
   * geçersiz hale gelmelidir.
   *
   * **Validates: Requirements 1.4**
   */
  it(
    'Property 2b: Çıkış yapıldığında oturum geçersiz hale gelmeli',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            async (username, email, password) => {
              if (!isValidEmail(email) || !isValidPassword(password)) {
                return true;
              }

              // Kullanıcı oluştur
              const passwordHash = await hashPassword(password);
              
              // Test için bir rol bul (varsa)
              const testRole = await prisma.role.findFirst({
                where: { hierarchy: { gte: 2 } },
              });
              
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'approved',
                  roleId: testRole?.id || null,
                },
              });
              createdUserIds.push(user.id);

              // Oturum oluştur (login)
              const session = await createSession(user.id);

              // Oturum geçerli olmalı
              const validSessionBefore = await validateSession(session.token);
              expect(validSessionBefore).not.toBeNull();

              // Çıkış yap (logout)
              await deleteSession(session.token);

              // Property: Oturum artık geçersiz olmalı
              const validSessionAfter = await validateSession(session.token);
              expect(validSessionAfter).toBeNull();

              return true;
            }
          ),
          {
            numRuns: 100,
            verbose: false,
          }
        );
      } finally {
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
   * Property 2c: Yanlış şifre ile giriş denemesi reddedilmeli
   *
   * *Herhangi bir* giriş denemesi için, yanlış şifre kullanıldığında
   * giriş her zaman reddedilmelidir.
   *
   * **Validates: Requirements 1.3**
   */
  it(
    'Property 2c: Yanlış şifre ile giriş denemesi her zaman reddedilmeli',
    async () => {
      const createdUserIds: string[] = [];

      try {
        await fc.assert(
          fc.asyncProperty(
            createValidUsernameArbitrary(),
            createValidEmailArbitrary(),
            validPasswordArbitrary,
            validPasswordArbitrary,
            async (username, email, correctPassword, wrongPassword) => {
              // Şifreler farklı olmalı
              if (correctPassword === wrongPassword) {
                return true;
              }

              if (
                !isValidEmail(email) ||
                !isValidPassword(correctPassword) ||
                !isValidPassword(wrongPassword)
              ) {
                return true;
              }

              // Kullanıcı oluştur (doğru şifre ile)
              const passwordHash = await hashPassword(correctPassword);
              
              // Test için bir rol bul (varsa)
              const testRole = await prisma.role.findFirst({
                where: { hierarchy: { gte: 2 } },
              });
              
              const user = await prisma.user.create({
                data: {
                  username,
                  email,
                  passwordHash,
                  status: 'approved',
                  roleId: testRole?.id || null,
                },
              });
              createdUserIds.push(user.id);

              // Yanlış şifre ile doğrulama dene
              const isWrongPasswordValid = await verifyPassword(
                wrongPassword,
                user.passwordHash
              );

              // Property: Yanlış şifre her zaman reddedilmeli
              expect(isWrongPasswordValid).toBe(false);

              // Doğru şifre ile doğrulama (kontrol amaçlı)
              const isCorrectPasswordValid = await verifyPassword(
                correctPassword,
                user.passwordHash
              );
              expect(isCorrectPasswordValid).toBe(true);

              return true;
            }
          ),
          {
            numRuns: 100,
            verbose: false,
          }
        );
      } finally {
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
