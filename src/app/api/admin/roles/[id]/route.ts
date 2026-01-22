/**
 * Rol Detay API Endpoint
 * GET: Rol detayını getirir
 * PUT: Rolü günceller (sadece owner)
 * DELETE: Rolü siler (sadece owner, sistem rolleri hariç)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getRoleById, updateRole, deleteRole } from '@/lib/roles';
import { hasPermission } from '@/lib/rbac';
import { logActivity } from '@/lib/logging';
import type { UpdateRoleInput } from '@/types';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/roles/[id]
 * Rol detayını getirir
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const { id } = await context.params;

        // Kimlik doğrulama
        const authResult = await getAuthenticatedUser(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: authResult.error || 'Yetkilendirme hatası' },
                { status: 401 }
            );
        }

        const { user } = authResult;

        // Yetki kontrolü
        if (!hasPermission(user.role, 'VIEW_USERS')) {
            return NextResponse.json(
                { success: false, error: 'Bu işlem için yetkiniz yok' },
                { status: 403 }
            );
        }

        // Rolü getir
        const role = await getRoleById(id);

        if (!role) {
            return NextResponse.json(
                { success: false, error: 'Rol bulunamadı' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            role,
        });
    } catch (error) {
        console.error('Rol detay hatası:', error);
        return NextResponse.json(
            { success: false, error: 'Rol yüklenirken bir hata oluştu' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/admin/roles/[id]
 * Rolü günceller (sadece owner)
 */
export async function PUT(request: NextRequest, context: RouteParams) {
    try {
        const { id } = await context.params;

        // Kimlik doğrulama
        const authResult = await getAuthenticatedUser(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: authResult.error || 'Yetkilendirme hatası' },
                { status: 401 }
            );
        }

        const { user } = authResult;

        // Yetki kontrolü
        if (!hasPermission(user.role, 'MANAGE_ROLES')) {
            return NextResponse.json(
                { success: false, error: 'Rol düzenleme yetkiniz yok' },
                { status: 403 }
            );
        }

        // Mevcut rolü kontrol et
        const existingRole = await getRoleById(id);
        if (!existingRole) {
            return NextResponse.json(
                { success: false, error: 'Rol bulunamadı' },
                { status: 404 }
            );
        }

        // Request body'yi parse et
        const body = await request.json();
        const { name, shortName, description, hierarchy, color, permissions } = body;

        // Güncelleme verisi oluştur
        const updateData: UpdateRoleInput = {};

        if (name !== undefined) updateData.name = name;
        if (shortName !== undefined) updateData.shortName = shortName;
        if (description !== undefined) updateData.description = description;
        if (hierarchy !== undefined) updateData.hierarchy = parseInt(hierarchy, 10);
        if (color !== undefined) updateData.color = color;
        if (permissions !== undefined) updateData.permissions = permissions;

        // Rolü güncelle
        const updatedRole = await updateRole(id, updateData);

        // Log kaydet
        await logActivity({
            userId: user.id,
            action: 'edit_role',
            details: {
                roleId: updatedRole.id,
                roleCode: updatedRole.code,
                roleName: updatedRole.name,
                changes: updateData,
            },
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        });

        return NextResponse.json({
            success: true,
            role: updatedRole,
            message: 'Rol başarıyla güncellendi',
        });
    } catch (error) {
        console.error('Rol güncelleme hatası:', error);
        const errorMessage = error instanceof Error ? error.message : 'Rol güncellenirken bir hata oluştu';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/admin/roles/[id]
 * Rolü siler (sadece owner, sistem rolleri hariç)
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const { id } = await context.params;

        // Kimlik doğrulama
        const authResult = await getAuthenticatedUser(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: authResult.error || 'Yetkilendirme hatası' },
                { status: 401 }
            );
        }

        const { user } = authResult;

        // Yetki kontrolü
        if (!hasPermission(user.role, 'MANAGE_ROLES')) {
            return NextResponse.json(
                { success: false, error: 'Rol silme yetkiniz yok' },
                { status: 403 }
            );
        }

        // Mevcut rolü kontrol et
        const existingRole = await getRoleById(id);
        if (!existingRole) {
            return NextResponse.json(
                { success: false, error: 'Rol bulunamadı' },
                { status: 404 }
            );
        }

        // Silme işlemini loglamak için bilgileri sakla
        const roleInfo = {
            roleId: existingRole.id,
            roleCode: existingRole.code,
            roleName: existingRole.name,
        };

        // Rolü sil
        await deleteRole(id);

        // Log kaydet
        await logActivity({
            userId: user.id,
            action: 'delete_role',
            details: roleInfo,
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        });

        return NextResponse.json({
            success: true,
            message: 'Rol başarıyla silindi',
        });
    } catch (error) {
        console.error('Rol silme hatası:', error);
        const errorMessage = error instanceof Error ? error.message : 'Rol silinirken bir hata oluştu';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
