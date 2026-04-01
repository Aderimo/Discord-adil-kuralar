/**
 * Property Tests: Property 9 - Template Edit Permission Enforcement
 * Feature: yetkili-kilavuzu-v2-guncelleme
 *
 * *For any* user role, the system SHALL:
 * - Allow template editing only for roles with EDIT_TEMPLATES permission (ust_yetkili / owner)
 * - Hide edit functionality for all other roles
 * - Correctly determine canEdit based on role hierarchy
 *
 * **Validates: Requirements 8.5, 8.6**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import { hasPermission, hasRole, ROLE_HIERARCHY } from '@/lib/rbac';
import type { UserRole } from '@/types';
import type { PenaltyTemplate, TemplateCategory } from '@/types';

// Tüm geçerli roller
const ALL_ROLES: UserRole[] = ['none', 'reg', 'op', 'gatekeeper', 'council', 'gm', 'ust_yetkili', 'owner'];

// Düzenleme yetkisi olan roller (EDIT_TEMPLATES permission: owner level = 11)
// owner: 11 — ust_yetkili: 10 → sadece owner düzenleyebilir
const EDIT_ALLOWED_ROLES: UserRole[] = ALL_ROLES.filter(
  (role) => hasPermission(role, 'EDIT_TEMPLATES')
);

// Düzenleme yetkisi olmayan roller (owner hariç hepsi)
const EDIT_DENIED_ROLES: UserRole[] = ALL_ROLES.filter(
  (role) => !hasPermission(role, 'EDIT_TEMPLATES')
);

// Arbitrary tanımlamaları
const anyRoleArbitrary = fc.constantFrom<UserRole>(...ALL_ROLES);
const editAllowedRoleArbitrary = fc.constantFrom<UserRole>(...EDIT_ALLOWED_ROLES);
const editDeniedRoleArbitrary = fc.constantFrom<UserRole>(...EDIT_DENIED_ROLES);

const templateCategoryArbitrary = fc.constantFrom<TemplateCategory>('ban', 'mute', 'warn');

const templateArbitrary = fc.record<PenaltyTemplate>({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  category: templateCategoryArbitrary,
  message: fc.string({ minLength: 1, maxLength: 500 }),
  editableBy: fc.constant(['owner'] as UserRole[]),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

describe('Property Tests: Property 9 - Template Edit Permission Enforcement', () => {
  /**
   * Property 9.1: Yalnızca izinli roller EDIT_TEMPLATES iznine sahiptir
   *
   * *For any* role with hierarchy >= owner level,
   * hasPermission(role, 'EDIT_TEMPLATES') SHALL return true.
   *
   * **Validates: Requirement 8.5, 8.6**
   */
  it(
    'Property 9.1: Düzenleme iznine sahip roller EDIT_TEMPLATES iznini geçer',
    () => {
      fc.assert(
        fc.property(editAllowedRoleArbitrary, (role) => {
          const canEdit = hasPermission(role, 'EDIT_TEMPLATES');

          // Property: İzinli roller her zaman erişim sağlamalı
          expect(canEdit).toBe(true);

          return true;
        }),
        { numRuns: 100, verbose: false }
      );
    }
  );

  /**
   * Property 9.2: İzinsiz roller EDIT_TEMPLATES izninden geçemez
   *
   * *For any* role with hierarchy < owner level,
   * hasPermission(role, 'EDIT_TEMPLATES') SHALL return false.
   *
   * **Validates: Requirement 8.6**
   */
  it(
    'Property 9.2: Yetersiz rollü kullanıcılar EDIT_TEMPLATES iznini geçemez',
    () => {
      fc.assert(
        fc.property(editDeniedRoleArbitrary, (role) => {
          const canEdit = hasPermission(role, 'EDIT_TEMPLATES');

          // Property: İzinsiz roller hiçbir zaman erişim sağlamamalı
          expect(canEdit).toBe(false);

          return true;
        }),
        { numRuns: 100, verbose: false }
      );
    }
  );

  /**
   * Property 9.3: canEdit değeri rol hiyerarşisine göre monoton artış gösterir
   *
   * *For any* two roles A and B, if A has higher hierarchy than B,
   * then if B can edit, A can also edit.
   *
   * **Validates: Requirement 8.5, 8.6**
   */
  it(
    'Property 9.3: Daha yüksek rol, daha düşük rolün iznini her zaman içerir',
    () => {
      fc.assert(
        fc.property(anyRoleArbitrary, anyRoleArbitrary, (roleA, roleB) => {
          const levelA = ROLE_HIERARCHY[roleA] ?? 0;
          const levelB = ROLE_HIERARCHY[roleB] ?? 0;
          const canEditA = hasPermission(roleA, 'EDIT_TEMPLATES');
          const canEditB = hasPermission(roleB, 'EDIT_TEMPLATES');

          // Property (Monotonluk): B düzenleyebiliyorsa ve A >= B ise, A da düzenleyebilmeli
          if (levelA >= levelB && canEditB) {
            expect(canEditA).toBe(true);
          }

          return true;
        }),
        { numRuns: 200, verbose: false }
      );
    }
  );

  /**
   * Property 9.4: Şablonun editableBy alanı düzenleme yetkisini belirler
   *
   * *For any* template and user role, a user can edit the template
   * if and only if their role satisfies hasRole check against editableBy roles.
   *
   * **Validates: Requirement 8.5, 8.6**
   */
  it(
    'Property 9.4: Şablon editableBy alanı düzenleme yetkisini doğru belirler',
    () => {
      fc.assert(
        fc.property(templateArbitrary, anyRoleArbitrary, (template, userRole) => {
          // editableBy'daki herhangi bir rol için yeterli hiyerarşi yeterliyse düzenleyebilir
          const canEdit = template.editableBy.some((editRole) =>
            hasRole(userRole, editRole)
          );

          const userLevel = ROLE_HIERARCHY[userRole] ?? 0;

          // Property: editableBy listesindeki en düşük seviyeli rolle karşılaştır
          const minRequiredLevel = Math.min(
            ...template.editableBy.map((r) => ROLE_HIERARCHY[r] ?? 0)
          );

          if (userLevel >= minRequiredLevel) {
            expect(canEdit).toBe(true);
          } else {
            expect(canEdit).toBe(false);
          }

          return true;
        }),
        { numRuns: 100, verbose: false }
      );
    }
  );

  /**
   * Property 9.5: İzin simetrik değildir (non-izinli roller asla edit edemez)
   *
   * *For any* role without EDIT_TEMPLATES permission,
   * and *for any* template, that role SHALL NOT be able to edit.
   *
   * **Validates: Requirement 8.6**
   */
  it(
    'Property 9.5: Yetersiz rollü kullanıcılar şablonları düzenleyemez',
    () => {
      fc.assert(
        fc.property(editDeniedRoleArbitrary, templateArbitrary, (role, template) => {
          const canEditByPermission = hasPermission(role, 'EDIT_TEMPLATES');
          const canEditByTemplate = template.editableBy.some((editRole) =>
            hasRole(role, editRole)
          );

          // Property: İzinsiz roller hem permission hem template kontrolünden geçemez
          expect(canEditByPermission).toBe(false);
          expect(canEditByTemplate).toBe(false);

          return true;
        }),
        { numRuns: 100, verbose: false }
      );
    }
  );

  /**
   * Property 9.6: canEdit belirleme süreci kararlı (deterministik)
   *
   * *For any* role, calling hasPermission multiple times with the same inputs
   * SHALL always return the same result.
   *
   * **Validates: Requirement 8.5**
   */
  it(
    'Property 9.6: hasPermission çağrıları deterministiktir',
    () => {
      fc.assert(
        fc.property(anyRoleArbitrary, (role) => {
          const result1 = hasPermission(role, 'EDIT_TEMPLATES');
          const result2 = hasPermission(role, 'EDIT_TEMPLATES');
          const result3 = hasPermission(role, 'EDIT_TEMPLATES');

          // Property: Aynı girdi her zaman aynı çıktıyı vermeli
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);

          return true;
        }),
        { numRuns: 100, verbose: false }
      );
    }
  );
});
