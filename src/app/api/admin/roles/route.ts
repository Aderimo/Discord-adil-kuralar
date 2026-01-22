/**
 * Rol Listesi API Endpoint
 * GET: Tüm rolleri listeler
 * POST: Yeni rol oluşturur (sadece owner)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getAllRoles, createRole } from '@/lib/roles';
import { hasPermission } from '@/lib/rbac';
import { logActivity } from '@/lib/logging';
import type { CreateRoleInput } from '@/types';

/**
 * GET /api/admin/roles
 * Tüm rolleri listeler
 */
export async function GET(request: NextRequest) {
    try {
        // Kimlik doğrulama
        const authResult = await getAuthenticatedUser(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: authResult.error || 'Yetkilendirme hatası' },
                { status: 401 }
            );
        }

        const { user } = authResult;

        // Yetki kontrolü - gk ve üstü rolle görebilir
        if (!hasPermission(user.role, 'VIEW_USERS')) {
            return NextResponse.json(
                { success: false, error: 'Bu işlem için yetkiniz yok' },
                { status: 403 }
            );
        }

        // Rolleri getir
        const roles = await getAllRoles();

        return NextResponse.json({
            success: true,
            roles,
        });
    } catch (error) {
        console.error('Rol listesi hatası:', error);
        return NextResponse.json(
            { success: false, error: 'Roller yüklenirken bir hata oluştu' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/roles
 * Yeni rol oluşturur (sadece owner)
 */
export async function POST(request: NextRequest) {
    try {
        // Kimlik doğrulama
        const authResult = await getAuthenticatedUser(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: authResult.error || 'Yetkilendirme hatası' },
                { status: 401 }
            );
        }

        const { user } = authResult;

        // Yetki kontrolü - sadece MANAGE_ROLES izni olanlar
        if (!hasPermission(user.role, 'MANAGE_ROLES')) {
            return NextResponse.json(
                { success: false, error: 'Rol oluşturma yetkiniz yok' },
                { status: 403 }
            );
        }

        // Request body'yi parse et
        const body = await request.json();
        const { code, name, shortName, description, hierarchy, color, permissions } = body;

        // Validasyon
        if (!code || !name || !shortName || !description || hierarchy === undefined) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Kod, ad, kısa ad, açıklama ve hiyerarşi alanları zorunludur',
                },
                { status: 400 }
            );
        }

        // Kod formatı kontrolü
        if (!/^[a-z_]+$/.test(code)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Rol kodu sadece küçük harf ve alt çizgi içerebilir',
                },
                { status: 400 }
            );
        }

        // Rol oluştur
        const roleData: CreateRoleInput = {
            code,
            name,
            shortName,
            description,
            hierarchy: parseInt(hierarchy, 10),
            color: color || '#5865F2',
            permissions: permissions || [],
            isSystem: false, // Kullanıcı oluşturulan roller sistem rolü değil
        };

        const newRole = await createRole(roleData);

        // Log kaydet
        await logActivity({
            userId: user.id,
            action: 'create_role',
            details: {
                roleId: newRole.id,
                roleCode: newRole.code,
                roleName: newRole.name,
            },
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        });

        return NextResponse.json({
            success: true,
            role: newRole,
            message: 'Rol başarıyla oluşturuldu',
        });
    } catch (error) {
        console.error('Rol oluşturma hatası:', error);
        const errorMessage = error instanceof Error ? error.message : 'Rol oluşturulurken bir hata oluştu';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
