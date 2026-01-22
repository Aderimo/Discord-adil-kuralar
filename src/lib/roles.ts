/**
 * Rol Yönetim Servisi
 * Dinamik rol CRUD işlemleri ve yetki kontrolleri
 *
 * Requirements:
 * - Rolleri görüntüleme, oluşturma, düzenleme, silme
 * - Hiyerarşi bazlı yetki kontrolü
 * - Sistem rolleri koruması
 */

import prisma from '@/lib/prisma';
import type { Role, CreateRoleInput, UpdateRoleInput, Permission } from '@/types';

// Rol cache - performans için
let roleCache: Role[] | null = null;
let roleCacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 dakika

/**
 * Veritabanından ham rol verisini Role tipine dönüştürür
 */
function mapDbRoleToRole(dbRole: {
    id: string;
    code: string;
    name: string;
    shortName: string;
    description: string;
    hierarchy: number;
    color: string;
    permissions: string;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}): Role {
    return {
        ...dbRole,
        permissions: JSON.parse(dbRole.permissions) as string[],
    };
}

/**
 * Rol cache'ini temizler
 */
export function clearRoleCache(): void {
    roleCache = null;
    roleCacheTimestamp = 0;
}

/**
 * Tüm rolleri veritabanından yükler (cache ile)
 */
export async function getAllRoles(): Promise<Role[]> {
    const now = Date.now();

    // Cache geçerli mi kontrol et
    if (roleCache && now - roleCacheTimestamp < CACHE_TTL) {
        return roleCache;
    }

    const dbRoles = await prisma.role.findMany({
        orderBy: { hierarchy: 'asc' },
    });

    roleCache = dbRoles.map(mapDbRoleToRole);
    roleCacheTimestamp = now;

    return roleCache;
}

/**
 * ID ile rol getirir
 */
export async function getRoleById(id: string): Promise<Role | null> {
    const roles = await getAllRoles();
    return roles.find((r) => r.id === id) || null;
}

/**
 * Kod ile rol getirir (örn: 'op', 'gk')
 */
export async function getRoleByCode(code: string): Promise<Role | null> {
    const roles = await getAllRoles();
    return roles.find((r) => r.code === code) || null;
}

/**
 * Hiyerarşi seviyesi ile rol getirir
 */
export async function getRoleByHierarchy(hierarchy: number): Promise<Role | null> {
    const roles = await getAllRoles();
    return roles.find((r) => r.hierarchy === hierarchy) || null;
}

/**
 * Yeni rol oluşturur
 */
export async function createRole(data: CreateRoleInput): Promise<Role> {
    // Kod benzersiz mi kontrol et
    const existingRole = await prisma.role.findUnique({
        where: { code: data.code },
    });

    if (existingRole) {
        throw new Error(`Rol kodu "${data.code}" zaten kullanılıyor`);
    }

    // Hiyerarşi benzersiz mi kontrol et
    const roles = await getAllRoles();
    const hierarchyExists = roles.some((r) => r.hierarchy === data.hierarchy);

    if (hierarchyExists) {
        throw new Error(`Hiyerarşi seviyesi ${data.hierarchy} zaten kullanılıyor`);
    }

    const dbRole = await prisma.role.create({
        data: {
            code: data.code,
            name: data.name,
            shortName: data.shortName,
            description: data.description,
            hierarchy: data.hierarchy,
            color: data.color,
            permissions: JSON.stringify(data.permissions),
            isSystem: data.isSystem,
        },
    });

    clearRoleCache();
    return mapDbRoleToRole(dbRole);
}

/**
 * Rolü günceller
 */
export async function updateRole(id: string, data: UpdateRoleInput): Promise<Role> {
    const existingRole = await prisma.role.findUnique({
        where: { id },
    });

    if (!existingRole) {
        throw new Error('Rol bulunamadı');
    }

    // Hiyerarşi değişiyorsa, benzersiz mi kontrol et
    if (data.hierarchy !== undefined && data.hierarchy !== existingRole.hierarchy) {
        const roles = await getAllRoles();
        const hierarchyExists = roles.some(
            (r) => r.hierarchy === data.hierarchy && r.id !== id
        );

        if (hierarchyExists) {
            throw new Error(`Hiyerarşi seviyesi ${data.hierarchy} zaten kullanılıyor`);
        }
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.shortName !== undefined) updateData.shortName = data.shortName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.hierarchy !== undefined) updateData.hierarchy = data.hierarchy;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.permissions !== undefined) {
        updateData.permissions = JSON.stringify(data.permissions);
    }

    const dbRole = await prisma.role.update({
        where: { id },
        data: updateData,
    });

    clearRoleCache();
    return mapDbRoleToRole(dbRole);
}

/**
 * Rolü siler
 */
export async function deleteRole(id: string): Promise<void> {
    const existingRole = await prisma.role.findUnique({
        where: { id },
    });

    if (!existingRole) {
        throw new Error('Rol bulunamadı');
    }

    if (existingRole.isSystem) {
        throw new Error('Sistem rolleri silinemez');
    }

    // Bu role sahip kullanıcılar var mı kontrol et
    const usersWithRole = await prisma.user.count({
        where: { roleId: id },
    });

    if (usersWithRole > 0) {
        throw new Error(
            `Bu rol ${usersWithRole} kullanıcıya atanmış. Silmeden önce kullanıcıların rolünü değiştirin.`
        );
    }

    await prisma.role.delete({
        where: { id },
    });

    clearRoleCache();
}

/**
 * Bir kullanıcının başka bir kullanıcının rolünü yönetip yönetemeyeceğini kontrol eder
 * Hiyerarşi bazlı: Daha yüksek hiyerarşi = daha yetkili
 */
export function canManageRole(userRole: Role, targetRole: Role): boolean {
    // Owner her şeyi yönetebilir
    if (userRole.code === 'owner') {
        return true;
    }

    // Sadece daha düşük hiyerarşili rolleri yönetebilir
    return userRole.hierarchy > targetRole.hierarchy;
}

/**
 * Bir rolün belirli bir izne sahip olup olmadığını kontrol eder
 */
export function hasRolePermission(role: Role | null, permission: Permission): boolean {
    if (!role) {
        return false;
    }

    // Owner her şeye sahip
    if (role.code === 'owner') {
        return true;
    }

    return role.permissions.includes(permission);
}

/**
 * Hiyerarşiye göre rolleri sıralar (yüksekten düşüğe)
 */
export async function getRolesSortedByHierarchy(
    descending: boolean = true
): Promise<Role[]> {
    const roles = await getAllRoles();

    return [...roles].sort((a, b) =>
        descending ? b.hierarchy - a.hierarchy : a.hierarchy - b.hierarchy
    );
}

/**
 * Belirli bir hiyerarşi seviyesinin üzerindeki rolleri getirir
 */
export async function getRolesAboveHierarchy(hierarchy: number): Promise<Role[]> {
    const roles = await getAllRoles();
    return roles.filter((r) => r.hierarchy > hierarchy);
}

/**
 * Belirli bir hiyerarşi seviyesinin altındaki rolleri getirir
 */
export async function getRolesBelowHierarchy(hierarchy: number): Promise<Role[]> {
    const roles = await getAllRoles();
    return roles.filter((r) => r.hierarchy < hierarchy);
}

/**
 * Tüm izin kodlarını döndürür
 */
export function getAllPermissions(): Permission[] {
    return [
        'VIEW_CONTENT',
        'EDIT_CONTENT',
        'DELETE_CONTENT',
        'VIEW_USERS',
        'EDIT_USERS',
        'DELETE_USERS',
        'VIEW_LOGS',
        'VIEW_NOTIFICATIONS',
        'EDIT_TEMPLATES',
        'MANAGE_ROLES',
    ];
}

/**
 * İzin açıklamalarını döndürür
 */
export function getPermissionDescriptions(): Record<Permission, string> {
    return {
        VIEW_CONTENT: 'İçerik görüntüleme (kılavuz, cezalar, komutlar, prosedürler)',
        EDIT_CONTENT: 'İçerik düzenleme',
        DELETE_CONTENT: 'İçerik silme',
        VIEW_USERS: 'Kullanıcı listesi görüntüleme',
        EDIT_USERS: 'Kullanıcı düzenleme (rol değiştirme, onaylama)',
        DELETE_USERS: 'Kullanıcı silme',
        VIEW_LOGS: 'Aktivite loglarını görüntüleme',
        VIEW_NOTIFICATIONS: 'Bildirimleri görüntüleme',
        EDIT_TEMPLATES: 'Ceza şablonlarını düzenleme',
        MANAGE_ROLES: 'Rol yönetimi (oluşturma, düzenleme, silme)',
    };
}
