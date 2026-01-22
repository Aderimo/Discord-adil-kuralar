/**
 * Property 9: Template Edit Permission Enforcement
 * Feature: yetkili-kilavuzu-v2-guncelleme
 *
 * *For any* penalty template, only users with ust_yetkili role SHALL be able to edit
 * the template. Non-ust_yetkili users SHALL see the template in read-only mode with
 * edit controls hidden.
 *
 * **Validates: Requirements 8.5, 8.6**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import type { Permission } from '@/types';

// Tüm roller
const ALL_ROLES = ['none', 'mod', 'admin', 'ust_yetkili'] as const;
type TestRole = (typeof ALL_ROLES)[number];

// ust_yetkili olmayan roller
const NON_UST_YETKILI_ROLES = ['none', 'mod', 'admin'] as const;
type NonUstYetkiliRole = (typeof NON_UST_YETKILI_ROLES)[number];

// Template düzenleme izni
const EDIT_TEMPLATES_PERMISSION: Permission = 'EDIT_TEMPLATES';

describe('Property Tests: Property 9 - Template Edit Permission Enforcement', () => {
  /**
   * Property 9.1: Sadece ust_yetkili rolü EDIT_TEMPLATES iznine sahip olmalı
   *
   * *For any* penalty template, only users with ust_yetkili role SHALL be able to
   * edit the template.
   *
   * **Validates: Requirements 8.5**
   */
  it(
    'Property 9.1: Sadece ust_yetkili rolü EDIT_TEMPLATES iznine sahip olmalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom<TestRole>(...ALL_ROLES),
          (role) => {
            const hasEditTemplatesPermission = hasPermission(role, EDIT_TEMPLATES_PERMISSION);
            const isUstYetkili = role === 'ust_yetkili';

            // Property: Sadece ust_yetkili EDIT_TEMPLATES iznine sahip olmalı
            expect(hasEditTemplatesPermission).toBe(isUstYetkili);

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
   * Property 9.2: mod rolü EDIT_TEMPLATES iznine sahip olmamalı
   *
   * *For any* mod user viewing templates, the system SHALL hide edit functionality.
   *
   * **Validates: Requirements 8.6**
   */
  it(
    'Property 9.2: mod rolü EDIT_TEMPLATES iznine sahip olmamalı',
    async () => {
      const hasAccess = hasPermission('mod', EDIT_TEMPLATES_PERMISSION);

      // Property: mod EDIT_TEMPLATES iznine sahip olmamalı
      expect(hasAccess).toBe(false);
    },
    30000
  );

  /**
   * Property 9.3: admin rolü EDIT_TEMPLATES iznine sahip olmamalı
   *
   * *For any* admin user viewing templates, the system SHALL hide edit functionality.
   *
   * **Validates: Requirements 8.6**
   */
  it(
    'Property 9.3: admin rolü EDIT_TEMPLATES iznine sahip olmamalı',
    async () => {
      const hasAccess = hasPermission('admin', EDIT_TEMPLATES_PERMISSION);

      // Property: admin EDIT_TEMPLATES iznine sahip olmamalı
      expect(hasAccess).toBe(false);
    },
    30000
  );

  /**
   * Property 9.4: ust_yetkili rolü EDIT_TEMPLATES iznine sahip olmalı
   *
   * *For any* ust_yetkili user, the system SHALL allow editing templates.
   *
   * **Validates: Requirements 8.5**
   */
  it(
    'Property 9.4: ust_yetkili rolü EDIT_TEMPLATES iznine sahip olmalı',
    async () => {
      const hasAccess = hasPermission('ust_yetkili', EDIT_TEMPLATES_PERMISSION);

      // Property: ust_yetkili EDIT_TEMPLATES iznine sahip olmalı
      expect(hasAccess).toBe(true);
    },
    30000
  );

  /**
   * Property 9.5: Non-ust_yetkili roller EDIT_TEMPLATES iznine sahip olmamalı
   *
   * *For any* non-ust_yetkili user (none, mod, admin), the system SHALL deny
   * EDIT_TEMPLATES permission and hide edit controls.
   *
   * **Validates: Requirements 8.6**
   */
  it(
    'Property 9.5: Non-ust_yetkili roller (none, mod, admin) EDIT_TEMPLATES iznine sahip olmamalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom<NonUstYetkiliRole>(...NON_UST_YETKILI_ROLES),
          (role) => {
            const hasAccess = hasPermission(role, EDIT_TEMPLATES_PERMISSION);

            // Property: Non-ust_yetkili roller EDIT_TEMPLATES iznine sahip olmamalı
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
   * Property 9.6: EDIT_TEMPLATES izni PERMISSIONS objesinde doğru tanımlanmış olmalı
   *
   * The PERMISSIONS object SHALL define EDIT_TEMPLATES with only ust_yetkili
   * (and equivalent high-level roles) having access.
   *
   * **Validates: Requirements 8.5, 8.6**
   */
  it(
    'Property 9.6: EDIT_TEMPLATES izni PERMISSIONS objesinde doğru tanımlanmış olmalı',
    async () => {
      // PERMISSIONS objesinde EDIT_TEMPLATES tanımlı olmalı
      expect(PERMISSIONS).toHaveProperty('EDIT_TEMPLATES');

      const editTemplatesRoles = PERMISSIONS.EDIT_TEMPLATES;

      // Property: EDIT_TEMPLATES izni bir dizi olmalı
      expect(Array.isArray(editTemplatesRoles)).toBe(true);

      // Property: mod ve admin bu dizide olmamalı
      expect(editTemplatesRoles).not.toContain('mod');
      expect(editTemplatesRoles).not.toContain('admin');
      expect(editTemplatesRoles).not.toContain('none');

      // Property: ust_yetkili bu dizide olmalı
      expect(editTemplatesRoles).toContain('ust_yetkili');
    },
    30000
  );

  /**
   * Property 9.7: Template düzenleme izni hiyerarşik olarak tutarlı olmalı
   *
   * *For any* role with EDIT_TEMPLATES permission, all higher roles in the hierarchy
   * SHALL also have this permission.
   *
   * **Validates: Requirements 8.5**
   */
  it(
    'Property 9.7: Template düzenleme izni hiyerarşik olarak tutarlı olmalı',
    async () => {
      // Rol hiyerarşisi: none < mod < admin < ust_yetkili
      const roleHierarchy: TestRole[] = ['none', 'mod', 'admin', 'ust_yetkili'];

      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: roleHierarchy.length - 1 }),
          (roleIndex) => {
            const role = roleHierarchy[roleIndex];
            const hasAccess = hasPermission(role, EDIT_TEMPLATES_PERMISSION);

            // Eğer bir rol EDIT_TEMPLATES iznine sahipse, üstündeki tüm roller de sahip olmalı
            if (hasAccess) {
              for (let i = roleIndex + 1; i < roleHierarchy.length; i++) {
                const higherRole = roleHierarchy[i];
                const higherHasAccess = hasPermission(higherRole, EDIT_TEMPLATES_PERMISSION);
                expect(higherHasAccess).toBe(true);
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
   * Property 9.8: null veya undefined rol EDIT_TEMPLATES iznine sahip olmamalı
   *
   * *For any* user without a valid role, the system SHALL deny EDIT_TEMPLATES permission.
   *
   * **Validates: Requirements 8.6**
   */
  it(
    'Property 9.8: null veya undefined rol EDIT_TEMPLATES iznine sahip olmamalı',
    async () => {
      // null rol kontrolü
      const nullRoleAccess = hasPermission(null, EDIT_TEMPLATES_PERMISSION);
      expect(nullRoleAccess).toBe(false);

      // 'none' rol kontrolü (rol atanmamış kullanıcı)
      const noneRoleAccess = hasPermission('none', EDIT_TEMPLATES_PERMISSION);
      expect(noneRoleAccess).toBe(false);
    },
    30000
  );

  /**
   * Property 9.9: Rastgele geçersiz roller EDIT_TEMPLATES iznine sahip olmamalı
   *
   * *For any* invalid or unknown role string, the system SHALL deny EDIT_TEMPLATES permission.
   *
   * **Validates: Requirements 8.6**
   */
  it(
    'Property 9.9: Rastgele geçersiz roller EDIT_TEMPLATES iznine sahip olmamalı',
    async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => !ALL_ROLES.includes(s as TestRole) && !['gm_plus', 'owner', 'gm', 'council', 'gk', 'op', 'reg'].includes(s)
          ),
          (invalidRole) => {
            const hasAccess = hasPermission(invalidRole, EDIT_TEMPLATES_PERMISSION);

            // Property: Geçersiz roller EDIT_TEMPLATES iznine sahip olmamalı
            expect(hasAccess).toBe(false);

            return true;
          }
        ),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    },
    30000
  );
});

describe('Property Tests: Property 9 - Template Read-Only Mode for Non-ust_yetkili', () => {
  /**
   * Property 9.10: Non-ust_yetkili kullanıcılar şablonları görüntüleyebilmeli (VIEW_CONTENT)
   *
   * *For any* non-ust_yetkili user, the system SHALL allow viewing templates
   * (read-only mode) but hide edit controls.
   *
   * **Validates: Requirements 8.6**
   */
  it(
    'Property 9.10: Non-ust_yetkili kullanıcılar şablonları görüntüleyebilmeli (VIEW_CONTENT)',
    async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom<NonUstYetkiliRole>('mod', 'admin'), // none hariç, çünkü none VIEW_CONTENT'e de sahip değil
          (role) => {
            const canView = hasPermission(role, 'VIEW_CONTENT');
            const canEdit = hasPermission(role, EDIT_TEMPLATES_PERMISSION);

            // Property: mod ve admin VIEW_CONTENT iznine sahip olmalı
            expect(canView).toBe(true);

            // Property: mod ve admin EDIT_TEMPLATES iznine sahip olmamalı
            expect(canEdit).toBe(false);

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
   * Property 9.11: ust_yetkili hem görüntüleme hem düzenleme iznine sahip olmalı
   *
   * *For any* ust_yetkili user, the system SHALL allow both viewing and editing templates.
   *
   * **Validates: Requirements 8.5**
   */
  it(
    'Property 9.11: ust_yetkili hem görüntüleme hem düzenleme iznine sahip olmalı',
    async () => {
      const canView = hasPermission('ust_yetkili', 'VIEW_CONTENT');
      const canEdit = hasPermission('ust_yetkili', EDIT_TEMPLATES_PERMISSION);

      // Property: ust_yetkili VIEW_CONTENT iznine sahip olmalı
      expect(canView).toBe(true);

      // Property: ust_yetkili EDIT_TEMPLATES iznine sahip olmalı
      expect(canEdit).toBe(true);
    },
    30000
  );
});
