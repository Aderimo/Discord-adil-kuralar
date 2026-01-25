/**
 * Property 6: Hassas Alan Filtreleme - Property-Based Tests
 * 
 * Feature: gelismis-loglama, Property 6: Hassas Alan Filtreleme
 * 
 * Bu test dosyası, hassas alan filtreleme özelliğinin doğruluğunu property-based testing
 * ile doğrular. Hassas alanlar (password, kişisel veri) loglanmamalı, normal alanlar loglanmalı.
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3**
 * 
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import {
  logTextInput,
  isSensitiveField,
  SENSITIVE_FIELD_PATTERNS,
  SENSITIVE_FORM_PATTERNS,
  truncateInputText,
  INPUT_TEXT_MAX_LENGTH,
  type TextInputLog,
  type TextInputDetails,
} from '@/lib/advanced-logging';
import { hashPassword } from '@/lib/auth';

// Test için ayrı Prisma client
const prisma = new PrismaClient();

// Test için benzersiz ID oluşturmak için
const testRunId = `sens_${Date.now().toString(36)}`;

// Test öncesi ve sonrası temizlik
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Test loglarını temizle
  await prisma.activityLog.deleteMany({
    where: {
      action: 'text_input',
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
  'notes',
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

// ============================================================================
// Property Tests
// ============================================================================

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
