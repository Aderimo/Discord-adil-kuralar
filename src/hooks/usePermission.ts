// usePermission hook - Rol bazlı UI kontrolü
// Requirement 6.6: THE System SHALL hide UI elements that the user cannot access based on their role

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, type Permission } from '@/lib/rbac';

/**
 * usePermission hook - Kullanıcının belirli bir izne sahip olup olmadığını kontrol eder
 * 
 * Bu hook, AuthContext'ten kullanıcı rolünü alır ve rbac.ts'deki hasPermission
 * fonksiyonunu kullanarak izin kontrolü yapar.
 * 
 * @param permission - Kontrol edilecek izin (PERMISSIONS objesinin key'lerinden biri)
 * @returns boolean - Kullanıcının izne sahip olup olmadığı
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const canEdit = usePermission('EDIT_CONTENT');
 *   const canDelete = usePermission('DELETE_USERS');
 *   
 *   return (
 *     <div>
 *       {canEdit && <EditButton />}
 *       {canDelete && <DeleteButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  
  const hasAccess = useMemo(() => {
    // Kullanıcı yoksa veya onaylı değilse izin yok
    if (!user || user.status !== 'approved') {
      return false;
    }
    
    // Rol 'none' ise izin yok
    if (user.role === 'none') {
      return false;
    }
    
    // hasPermission fonksiyonu ile kontrol et
    return hasPermission(user.role, permission);
  }, [user, permission]);
  
  return hasAccess;
}

/**
 * usePermissions hook - Birden fazla izni aynı anda kontrol eder
 * 
 * @param permissions - Kontrol edilecek izinler dizisi
 * @returns Record<Permission, boolean> - Her izin için sonuç objesi
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const permissions = usePermissions(['EDIT_CONTENT', 'DELETE_CONTENT', 'VIEW_LOGS']);
 *   
 *   return (
 *     <div>
 *       {permissions.EDIT_CONTENT && <EditButton />}
 *       {permissions.DELETE_CONTENT && <DeleteButton />}
 *       {permissions.VIEW_LOGS && <LogsLink />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions<T extends Permission>(
  permissions: T[]
): Record<T, boolean> {
  const { user } = useAuth();
  
  const results = useMemo(() => {
    const permissionResults = {} as Record<T, boolean>;
    
    for (const permission of permissions) {
      // Kullanıcı yoksa veya onaylı değilse izin yok
      if (!user || user.status !== 'approved' || user.role === 'none') {
        permissionResults[permission] = false;
      } else {
        permissionResults[permission] = hasPermission(user.role, permission);
      }
    }
    
    return permissionResults;
  }, [user, permissions]);
  
  return results;
}

export default usePermission;
