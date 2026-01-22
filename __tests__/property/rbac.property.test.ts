/**
 * RBAC Property-Based Tests
 * Feature: yetkili-kilavuzu, Property 3: Yetki Tabanlı Erişim Kontrolü
 *
 * *Herhangi bir* sayfa isteği için, kullanıcının yetki durumu kontrol edilmeli ve:
 * - Onaylanmamış/yetkisiz kullanıcılar sadece engelleme mesajını görmeli
 * - Onaylı kullanıcılar yetki seviyelerine uygun içeriğe erişebilmeli
 * - "Beklemede" durumundaki kullanıcılar ana içeriğe erişememeli
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import {
  hasRole,
  canAccess,
  checkRouteAccess,
  ROLE_HIERARCHY,
  type AccessDeniedReason,
} from '@/lib/rbac';
import type { User, UserRole, UserStatus } from '@/types';

// Test için kullanıcı oluşturma yardımcı fonksiyonu
function createTestUser(
  status: UserStatus,
  role: UserRole,
  id?: string
): User {
  return {
    id: id || `test-user-${Date.now()}`,
    username: 'testuser',
    email: 'test@example.com',
    status,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Arbitrary tanımlamaları
const userRoleArbitrary = fc.constantFrom<UserRole>(
  'none',
  'mod',
  'admin',
  'ust_yetkili'
);

const userStatusArbitrary = fc.constantFrom<UserStatus>(
  'pending',
  'approved',
  'rejected'
);

// Korumalı rotalar (mod+ gerekli)
const protectedRouteArbitrary = fc.constantFrom(
  '/',
  '/dashboard',
  '/guide',
  '/penalties',
  '/commands',
  '/procedures',
  '/content',
  '/search'
);

// Admin rotaları
const adminRouteArbitrary = fc.constantFrom(
  '/admin',
  '/admin/users',
  '/admin/logs',
  '/admin/settings'
);

// Public rotalar
const publicRouteArbitrary = fc.constantFrom(
  '/login',
  '/register',
  '/unauthorized'
);

describe('Property Tests: RBAC - Yetki Tabanlı Erişim Kontrolü', () => {
  /**
   * Property 3a: Kimliği doğrulanmamış kullanıcılar korumalı rotalara erişemez
   *
   * *Herhangi bir* korumalı rota için, giriş yapmamış kullanıcılar
   * erişim izni alamamalı ve login sayfasına yönlendirilmelidir.
   *
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    'Property 3a: Kimliği doğrulanmamış kullanıcılar korumalı rotalara erişemez',
    async () => {
      await fc.assert(
        fc.property(protectedRouteArbitrary, (route) => {
          // Kullanıcı yok (giriş yapılmamış)
          const result = checkRouteAccess(route, null);

          // Property: Erişim reddedilmeli
          expect(result.allowed).toBe(false);

          // Property: Login sayfasına yönlendirilmeli
          expect(result.redirect).toBe('/login');

          // Property: Neden "not_authenticated" olmalı
          expect(result.reason).toBe('not_authenticated');

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
   * Property 3b: "Beklemede" durumundaki kullanıcılar sadece /pending rotasına erişebilir
   *
   * *Herhangi bir* "pending" durumundaki kullanıcı için:
   * - /pending rotasına erişebilmeli
   * - Diğer korumalı rotalara erişememeli
   *
   * **Validates: Requirements 2.3**
   */
  it(
    'Property 3b: Beklemede durumundaki kullanıcılar sadece /pending rotasına erişebilir',
    async () => {
      await fc.assert(
        fc.property(userRoleArbitrary, protectedRouteArbitrary, (role, route) => {
          // Pending durumunda kullanıcı oluştur
          const pendingUser = createTestUser('pending', role);

          // Korumalı rotalara erişim kontrolü
          const result = checkRouteAccess(route, pendingUser);

          // Property: Korumalı rotalara erişim reddedilmeli
          expect(result.allowed).toBe(false);

          // Property: /pending sayfasına yönlendirilmeli
          expect(result.redirect).toBe('/pending');

          // Property: Neden "pending_approval" olmalı
          expect(result.reason).toBe('pending_approval');

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
   * Property 3b.1: Beklemede kullanıcılar /pending rotasına erişebilmeli
   *
   * **Validates: Requirements 2.3**
   */
  it(
    'Property 3b.1: Beklemede kullanıcılar /pending rotasına erişebilmeli',
    async () => {
      await fc.assert(
        fc.property(userRoleArbitrary, (role) => {
          const pendingUser = createTestUser('pending', role);

          // /pending rotasına erişim kontrolü
          const result = checkRouteAccess('/pending', pendingUser);

          // Property: /pending rotasına erişim izni verilmeli
          expect(result.allowed).toBe(true);

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
   * Property 3c: Reddedilmiş kullanıcılar /unauthorized sayfasına yönlendirilir
   *
   * *Herhangi bir* "rejected" durumundaki kullanıcı için,
   * korumalı rotalara erişim reddedilmeli ve /unauthorized'a yönlendirilmelidir.
   *
   * **Validates: Requirements 2.1**
   */
  it(
    'Property 3c: Reddedilmiş kullanıcılar /unauthorized sayfasına yönlendirilir',
    async () => {
      await fc.assert(
        fc.property(userRoleArbitrary, protectedRouteArbitrary, (role, route) => {
          // Rejected durumunda kullanıcı oluştur
          const rejectedUser = createTestUser('rejected', role);

          // Korumalı rotalara erişim kontrolü
          const result = checkRouteAccess(route, rejectedUser);

          // Property: Erişim reddedilmeli
          expect(result.allowed).toBe(false);

          // Property: /unauthorized sayfasına yönlendirilmeli
          expect(result.redirect).toBe('/unauthorized');

          // Property: Neden "rejected" olmalı
          expect(result.reason).toBe('rejected');

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
   * Property 3d: Onaylı kullanıcılar yeterli role sahipse erişebilir
   *
   * *Herhangi bir* onaylı kullanıcı için, yetki seviyesi yeterliyse
   * korumalı rotalara erişebilmelidir.
   *
   * **Validates: Requirements 2.2, 2.4**
   */
  it(
    'Property 3d: Onaylı kullanıcılar yeterli role sahipse korumalı rotalara erişebilir',
    async () => {
      // Sadece mod, admin, ust_yetkili rolleri (none hariç)
      const validRoleArbitrary = fc.constantFrom<UserRole>(
        'mod',
        'admin',
        'ust_yetkili'
      );

      await fc.assert(
        fc.property(validRoleArbitrary, protectedRouteArbitrary, (role, route) => {
          // Onaylı ve geçerli role sahip kullanıcı
          const approvedUser = createTestUser('approved', role);

          // Korumalı rotalara erişim kontrolü
          const result = checkRouteAccess(route, approvedUser);

          // Property: Erişim izni verilmeli
          expect(result.allowed).toBe(true);

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
   * Property 3d.1: Onaylı ama "none" rolündeki kullanıcılar erişemez
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it(
    'Property 3d.1: Onaylı ama "none" rolündeki kullanıcılar korumalı rotalara erişemez',
    async () => {
      await fc.assert(
        fc.property(protectedRouteArbitrary, (route) => {
          // Onaylı ama role = none
          const noRoleUser = createTestUser('approved', 'none');

          // Korumalı rotalara erişim kontrolü
          const result = checkRouteAccess(route, noRoleUser);

          // Property: Erişim reddedilmeli
          expect(result.allowed).toBe(false);

          // Property: /unauthorized sayfasına yönlendirilmeli
          expect(result.redirect).toBe('/unauthorized');

          // Property: Neden "no_role" olmalı
          expect(result.reason).toBe('no_role');

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
   * Property 3e: Rol hiyerarşisi doğru çalışır
   *
   * Üst roller, alt rollerin yetkilerine sahip olmalıdır:
   * - ust_yetkili > admin > mod > none
   * - Admin, mod rotalarına erişebilmeli
   * - Mod, admin rotalarına erişememeli
   *
   * **Validates: Requirements 2.2**
   */
  it(
    'Property 3e: Rol hiyerarşisi doğru çalışır - üst roller alt rollerin yetkilerine sahip',
    async () => {
      await fc.assert(
        fc.property(userRoleArbitrary, userRoleArbitrary, (userRole, requiredRole) => {
          // hasRole fonksiyonu hiyerarşiyi doğru uygulamalı
          const hasAccess = hasRole(userRole, requiredRole);

          // Property: Hiyerarşi kuralı
          const userLevel = ROLE_HIERARCHY[userRole];
          const requiredLevel = ROLE_HIERARCHY[requiredRole];

          // Kullanıcı seviyesi >= gerekli seviye ise erişim olmalı
          expect(hasAccess).toBe(userLevel >= requiredLevel);

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
   * Property 3e.1: Admin kullanıcılar mod rotalarına erişebilir
   *
   * **Validates: Requirements 2.2**
   */
  it(
    'Property 3e.1: Admin kullanıcılar mod gerektiren rotalara erişebilir',
    async () => {
      await fc.assert(
        fc.property(protectedRouteArbitrary, (route) => {
          // Admin kullanıcı
          const adminUser = createTestUser('approved', 'admin');

          // Mod gerektiren rotalara erişim kontrolü
          const result = checkRouteAccess(route, adminUser);

          // Property: Admin, mod rotalarına erişebilmeli
          expect(result.allowed).toBe(true);

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
   * Property 3e.2: Mod kullanıcılar admin rotalarına erişemez
   *
   * **Validates: Requirements 2.2**
   */
  it(
    'Property 3e.2: Mod kullanıcılar admin rotalarına erişemez',
    async () => {
      await fc.assert(
        fc.property(adminRouteArbitrary, (route) => {
          // Mod kullanıcı
          const modUser = createTestUser('approved', 'mod');

          // Admin rotalarına erişim kontrolü
          const result = checkRouteAccess(route, modUser);

          // Property: Mod, admin rotalarına erişememeli
          expect(result.allowed).toBe(false);

          // Property: /unauthorized sayfasına yönlendirilmeli
          expect(result.redirect).toBe('/unauthorized');

          // Property: Neden "insufficient_role" olmalı
          expect(result.reason).toBe('insufficient_role');

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
   * Property 3e.3: Admin ve üst yetkili admin rotalarına erişebilir
   *
   * **Validates: Requirements 2.2**
   */
  it(
    'Property 3e.3: Admin ve üst yetkili admin rotalarına erişebilir',
    async () => {
      const adminOrHigherArbitrary = fc.constantFrom<UserRole>(
        'admin',
        'ust_yetkili'
      );

      await fc.assert(
        fc.property(adminOrHigherArbitrary, adminRouteArbitrary, (role, route) => {
          // Admin veya üst yetkili kullanıcı
          const user = createTestUser('approved', role);

          // Admin rotalarına erişim kontrolü
          const result = checkRouteAccess(route, user);

          // Property: Admin+, admin rotalarına erişebilmeli
          expect(result.allowed).toBe(true);

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

describe('Property Tests: RBAC - canAccess Fonksiyonu', () => {
  /**
   * Property 3f: canAccess fonksiyonu tüm durumları doğru değerlendirir
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it(
    'Property 3f: canAccess fonksiyonu kullanıcı durumuna göre doğru sonuç döner',
    async () => {
      await fc.assert(
        fc.property(
          userStatusArbitrary,
          userRoleArbitrary,
          userRoleArbitrary,
          (status, role, requiredRole) => {
            const user = createTestUser(status, role);
            const result = canAccess(user, requiredRole);

            // Durum bazlı kontroller
            if (status === 'pending') {
              // Pending kullanıcılar erişemez
              expect(result.allowed).toBe(false);
              expect(result.reason).toBe('pending_approval');
            } else if (status === 'rejected') {
              // Rejected kullanıcılar erişemez
              expect(result.allowed).toBe(false);
              expect(result.reason).toBe('rejected');
            } else if (status === 'approved') {
              if (role === 'none') {
                // Rol atanmamış kullanıcılar erişemez
                expect(result.allowed).toBe(false);
                expect(result.reason).toBe('no_role');
              } else {
                // Rol hiyerarşisine göre erişim
                const hasAccess = hasRole(role, requiredRole);
                expect(result.allowed).toBe(hasAccess);
                if (!hasAccess) {
                  expect(result.reason).toBe('insufficient_role');
                }
              }
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
   * Property 3g: null kullanıcı her zaman erişim reddedilir
   *
   * **Validates: Requirements 2.1, 2.4**
   */
  it(
    'Property 3g: null kullanıcı için erişim her zaman reddedilir',
    async () => {
      await fc.assert(
        fc.property(userRoleArbitrary, (requiredRole) => {
          const result = canAccess(null, requiredRole);

          // Property: Erişim reddedilmeli
          expect(result.allowed).toBe(false);

          // Property: Neden "not_authenticated" olmalı
          expect(result.reason).toBe('not_authenticated');

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

describe('Property Tests: RBAC - Public Rotalar', () => {
  /**
   * Property 3h: Public rotalar herkese açık
   *
   * **Validates: Requirements 2.1**
   */
  it(
    'Property 3h: Public rotalar kimliği doğrulanmamış kullanıcılara açık',
    async () => {
      // /unauthorized her zaman public
      const result = checkRouteAccess('/unauthorized', null);

      // Property: Erişim izni verilmeli
      expect(result.allowed).toBe(true);
    },
    30000
  );

  /**
   * Property 3i: Login/Register sayfaları giriş yapmış onaylı kullanıcıları yönlendirir
   *
   * **Validates: Requirements 2.2**
   */
  it(
    'Property 3i: Login/Register sayfaları giriş yapmış onaylı kullanıcıları ana sayfaya yönlendirir',
    async () => {
      const authPageArbitrary = fc.constantFrom('/login', '/register');
      const validRoleArbitrary = fc.constantFrom<UserRole>(
        'mod',
        'admin',
        'ust_yetkili'
      );

      await fc.assert(
        fc.property(authPageArbitrary, validRoleArbitrary, (page, role) => {
          // Onaylı kullanıcı
          const approvedUser = createTestUser('approved', role);

          // Auth sayfalarına erişim kontrolü
          const result = checkRouteAccess(page, approvedUser);

          // Property: Erişim reddedilmeli (yönlendirme için)
          expect(result.allowed).toBe(false);

          // Property: Ana sayfaya yönlendirilmeli
          expect(result.redirect).toBe('/');

          // Property: Neden "redirect_authenticated" olmalı
          expect(result.reason).toBe('redirect_authenticated');

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


/**
 * Property 6: RBAC Permission Enforcement
 * Feature: yetkili-kilavuzu-v2-guncelleme
 *
 * *For any* user with a given role (mod, admin, ust_yetkili), the system SHALL grant
 * exactly the permissions defined for that role:
 * - mod gets view-only (VIEW_CONTENT only)
 * - admin gets view+edit (VIEW_CONTENT, VIEW_USERS, EDIT_CONTENT, EDIT_USERS)
 * - ust_yetkili gets view+edit+delete (ALL permissions)
 *
 * UI elements for unauthorized actions SHALL be hidden.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**
 */
import { hasPermission, PERMISSIONS, type Permission } from '@/lib/rbac';

// Tüm izinlerin listesi
const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSIONS) as Permission[];

// Rol bazlı beklenen izinler
const MOD_EXPECTED_PERMISSIONS: Permission[] = ['VIEW_CONTENT'];
const ADMIN_EXPECTED_PERMISSIONS: Permission[] = [
  'VIEW_CONTENT',
  'VIEW_USERS',
  'EDIT_CONTENT',
  'EDIT_USERS',
];
const UST_YETKILI_EXPECTED_PERMISSIONS: Permission[] = ALL_PERMISSIONS;

// Rol bazlı yasaklı izinler
const MOD_FORBIDDEN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => !MOD_EXPECTED_PERMISSIONS.includes(p)
);
const ADMIN_FORBIDDEN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => !ADMIN_EXPECTED_PERMISSIONS.includes(p)
);

describe('Property Tests: Property 6 - RBAC Permission Enforcement', () => {
  /**
   * Property 6.1: Mod rolü sadece VIEW_CONTENT iznine sahip olmalı
   *
   * *For any* mod user, the system SHALL grant only VIEW_CONTENT permission.
   * All other permissions (VIEW_USERS, VIEW_LOGS, VIEW_NOTIFICATIONS, EDIT_*, DELETE_*)
   * SHALL be denied.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 6.1: Mod rolü sadece VIEW_CONTENT iznine sahip olmalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...ALL_PERMISSIONS),
          (permission) => {
            const hasAccess = hasPermission('mod', permission);
            const shouldHaveAccess = MOD_EXPECTED_PERMISSIONS.includes(permission);

            // Property: Mod sadece VIEW_CONTENT iznine sahip olmalı
            expect(hasAccess).toBe(shouldHaveAccess);

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
   * Property 6.2: Mod rolünün yasaklı izinleri olmamalı
   *
   * *For any* permission in the forbidden list for mod role,
   * hasPermission SHALL return false.
   *
   * **Validates: Requirements 6.3, 6.6**
   */
  it(
    'Property 6.2: Mod rolünün yasaklı izinleri (VIEW_LOGS, VIEW_NOTIFICATIONS, VIEW_USERS, EDIT_*, DELETE_*) olmamalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...MOD_FORBIDDEN_PERMISSIONS),
          (permission) => {
            const hasAccess = hasPermission('mod', permission);

            // Property: Mod bu izinlere sahip olmamalı
            expect(hasAccess).toBe(false);

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
   * Property 6.3: Admin rolü VIEW_* ve EDIT_* izinlerine sahip olmalı (bazı istisnalar hariç)
   *
   * *For any* admin user, the system SHALL grant:
   * - VIEW_CONTENT, VIEW_USERS
   * - EDIT_CONTENT, EDIT_USERS
   *
   * But NOT:
   * - VIEW_LOGS, VIEW_NOTIFICATIONS (only ust_yetkili)
   * - EDIT_TEMPLATES (only ust_yetkili)
   * - DELETE_* (only ust_yetkili)
   *
   * **Validates: Requirements 6.2**
   */
  it(
    'Property 6.3: Admin rolü VIEW_* ve EDIT_* izinlerine sahip olmalı (DELETE_*, VIEW_LOGS, VIEW_NOTIFICATIONS, EDIT_TEMPLATES hariç)',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...ALL_PERMISSIONS),
          (permission) => {
            const hasAccess = hasPermission('admin', permission);
            const shouldHaveAccess = ADMIN_EXPECTED_PERMISSIONS.includes(permission);

            // Property: Admin beklenen izinlere sahip olmalı
            expect(hasAccess).toBe(shouldHaveAccess);

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
   * Property 6.4: Admin rolünün yasaklı izinleri olmamalı
   *
   * *For any* permission in the forbidden list for admin role,
   * hasPermission SHALL return false.
   *
   * **Validates: Requirements 6.2, 6.6**
   */
  it(
    'Property 6.4: Admin rolünün yasaklı izinleri (DELETE_*, VIEW_LOGS, VIEW_NOTIFICATIONS, EDIT_TEMPLATES) olmamalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...ADMIN_FORBIDDEN_PERMISSIONS),
          (permission) => {
            const hasAccess = hasPermission('admin', permission);

            // Property: Admin bu izinlere sahip olmamalı
            expect(hasAccess).toBe(false);

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
   * Property 6.5: Üst yetkili rolü TÜM izinlere sahip olmalı
   *
   * *For any* ust_yetkili user, the system SHALL grant ALL permissions
   * including view, edit, and delete.
   *
   * **Validates: Requirements 6.1**
   */
  it(
    'Property 6.5: Üst yetkili rolü TÜM izinlere sahip olmalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...ALL_PERMISSIONS),
          (permission) => {
            const hasAccess = hasPermission('ust_yetkili', permission);

            // Property: Üst yetkili tüm izinlere sahip olmalı
            expect(hasAccess).toBe(true);

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
   * Property 6.6: İzin hiyerarşisi tutarlı olmalı - üst roller alt rollerin tüm izinlerine sahip
   *
   * *For any* permission that a lower role has, all higher roles SHALL also have that permission.
   * Hierarchy: mod < admin < ust_yetkili
   *
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   */
  it(
    'Property 6.6: İzin hiyerarşisi tutarlı olmalı - üst roller alt rollerin tüm izinlerine sahip',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...ALL_PERMISSIONS),
          (permission) => {
            const modHas = hasPermission('mod', permission);
            const adminHas = hasPermission('admin', permission);
            const ustYetkiliHas = hasPermission('ust_yetkili', permission);

            // Property: Eğer mod bir izne sahipse, admin ve ust_yetkili de sahip olmalı
            if (modHas) {
              expect(adminHas).toBe(true);
              expect(ustYetkiliHas).toBe(true);
            }

            // Property: Eğer admin bir izne sahipse, ust_yetkili de sahip olmalı
            if (adminHas) {
              expect(ustYetkiliHas).toBe(true);
            }

            // Property: ust_yetkili her zaman tüm izinlere sahip
            expect(ustYetkiliHas).toBe(true);

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
   * Property 6.7: 'none' rolü hiçbir izne sahip olmamalı
   *
   * *For any* user with 'none' role, the system SHALL deny ALL permissions.
   *
   * **Validates: Requirements 6.4, 6.6**
   */
  it(
    'Property 6.7: "none" rolü hiçbir izne sahip olmamalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(...ALL_PERMISSIONS),
          (permission) => {
            const hasAccess = hasPermission('none', permission);

            // Property: 'none' rolü hiçbir izne sahip olmamalı
            expect(hasAccess).toBe(false);

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
   * Property 6.8: Silme izinleri sadece üst yetkililere ait olmalı
   *
   * *For any* DELETE_* permission, only ust_yetkili role SHALL have access.
   * mod and admin roles SHALL NOT have delete permissions.
   *
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  it(
    'Property 6.8: Silme izinleri (DELETE_*) sadece üst yetkililere ait olmalı',
    async () => {
      const deletePermissions: Permission[] = ['DELETE_CONTENT', 'DELETE_USERS'];

      await fc.assert(
        fc.property(
          fc.constantFrom(...deletePermissions),
          (permission) => {
            const modHas = hasPermission('mod', permission);
            const adminHas = hasPermission('admin', permission);
            const ustYetkiliHas = hasPermission('ust_yetkili', permission);

            // Property: Mod silme iznine sahip olmamalı
            expect(modHas).toBe(false);

            // Property: Admin silme iznine sahip olmamalı
            expect(adminHas).toBe(false);

            // Property: Üst yetkili silme iznine sahip olmalı
            expect(ustYetkiliHas).toBe(true);

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
   * Property 6.9: Özel izinler (VIEW_LOGS, VIEW_NOTIFICATIONS) sadece üst yetkililere ait olmalı
   *
   * *For any* special permission (VIEW_LOGS, VIEW_NOTIFICATIONS), only ust_yetkili role
   * SHALL have access.
   *
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  it(
    'Property 6.9: Özel izinler (VIEW_LOGS, VIEW_NOTIFICATIONS) sadece üst yetkililere ait olmalı',
    async () => {
      const specialPermissions: Permission[] = ['VIEW_LOGS', 'VIEW_NOTIFICATIONS'];

      await fc.assert(
        fc.property(
          fc.constantFrom(...specialPermissions),
          (permission) => {
            const modHas = hasPermission('mod', permission);
            const adminHas = hasPermission('admin', permission);
            const ustYetkiliHas = hasPermission('ust_yetkili', permission);

            // Property: Mod bu izinlere sahip olmamalı
            expect(modHas).toBe(false);

            // Property: Admin bu izinlere sahip olmamalı
            expect(adminHas).toBe(false);

            // Property: Üst yetkili bu izinlere sahip olmalı
            expect(ustYetkiliHas).toBe(true);

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
   * Property 6.10: EDIT_TEMPLATES izni sadece üst yetkililere ait olmalı
   *
   * *For any* user, only ust_yetkili role SHALL have EDIT_TEMPLATES permission.
   *
   * **Validates: Requirements 6.1, 6.2**
   */
  it(
    'Property 6.10: EDIT_TEMPLATES izni sadece üst yetkililere ait olmalı',
    async () => {
      const modHas = hasPermission('mod', 'EDIT_TEMPLATES');
      const adminHas = hasPermission('admin', 'EDIT_TEMPLATES');
      const ustYetkiliHas = hasPermission('ust_yetkili', 'EDIT_TEMPLATES');

      // Property: Mod EDIT_TEMPLATES iznine sahip olmamalı
      expect(modHas).toBe(false);

      // Property: Admin EDIT_TEMPLATES iznine sahip olmamalı
      expect(adminHas).toBe(false);

      // Property: Üst yetkili EDIT_TEMPLATES iznine sahip olmalı
      expect(ustYetkiliHas).toBe(true);
    },
    30000
  );
});
