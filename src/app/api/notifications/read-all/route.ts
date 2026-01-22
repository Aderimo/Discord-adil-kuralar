/**
 * Tüm Bildirimleri Okundu Yap API Endpoint
 * POST: Kullanıcının tüm bildirimlerini okundu olarak işaretler
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { markAllAsRead } from '@/lib/notifications';
import { hasPermission } from '@/lib/rbac';

/**
 * POST /api/notifications/read-all
 * Tüm bildirimleri okundu olarak işaretler
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

        // Yetki kontrolü
        if (!hasPermission(user.role, 'VIEW_NOTIFICATIONS')) {
            return NextResponse.json(
                { success: false, error: 'Bu işlem için yetkiniz yok' },
                { status: 403 }
            );
        }

        // Tüm bildirimleri okundu olarak işaretle
        const count = await markAllAsRead(user.id);

        return NextResponse.json({
            success: true,
            message: `${count} bildirim okundu olarak işaretlendi`,
            count,
        });
    } catch (error) {
        console.error('Bildirim güncelleme hatası:', error);
        return NextResponse.json(
            { success: false, error: 'Bildirimler güncellenirken bir hata oluştu' },
            { status: 500 }
        );
    }
}
