/**
 * Bildirim Detay API Endpoint
 * PUT: Bildirimi okundu olarak işaretler
 * DELETE: Bildirimi siler
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { markAsRead, deleteNotification } from '@/lib/notifications';
import { hasPermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * PUT /api/notifications/[id]
 * Bildirimi okundu olarak işaretler
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
        if (!hasPermission(user.role, 'VIEW_NOTIFICATIONS')) {
            return NextResponse.json(
                { success: false, error: 'Bu işlem için yetkiniz yok' },
                { status: 403 }
            );
        }

        // Bildirimin kullanıcıya ait olduğunu kontrol et
        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) {
            return NextResponse.json(
                { success: false, error: 'Bildirim bulunamadı' },
                { status: 404 }
            );
        }

        if (notification.userId !== user.id) {
            return NextResponse.json(
                { success: false, error: 'Bu bildirime erişim yetkiniz yok' },
                { status: 403 }
            );
        }

        // Bildirimi okundu olarak işaretle
        const updatedNotification = await markAsRead(id);

        return NextResponse.json({
            success: true,
            notification: updatedNotification,
        });
    } catch (error) {
        console.error('Bildirim güncelleme hatası:', error);
        return NextResponse.json(
            { success: false, error: 'Bildirim güncellenirken bir hata oluştu' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/notifications/[id]
 * Bildirimi siler
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
        if (!hasPermission(user.role, 'VIEW_NOTIFICATIONS')) {
            return NextResponse.json(
                { success: false, error: 'Bu işlem için yetkiniz yok' },
                { status: 403 }
            );
        }

        // Bildirimin kullanıcıya ait olduğunu kontrol et
        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) {
            return NextResponse.json(
                { success: false, error: 'Bildirim bulunamadı' },
                { status: 404 }
            );
        }

        if (notification.userId !== user.id) {
            return NextResponse.json(
                { success: false, error: 'Bu bildirime erişim yetkiniz yok' },
                { status: 403 }
            );
        }

        // Bildirimi sil
        await deleteNotification(id);

        return NextResponse.json({
            success: true,
            message: 'Bildirim silindi',
        });
    } catch (error) {
        console.error('Bildirim silme hatası:', error);
        return NextResponse.json(
            { success: false, error: 'Bildirim silinirken bir hata oluştu' },
            { status: 500 }
        );
    }
}
