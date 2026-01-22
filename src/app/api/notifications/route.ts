/**
 * Bildirim Listesi API Endpoint
 * GET: Kullanıcının bildirimlerini listeler
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getNotificationsForUser } from '@/lib/notifications';
import { hasPermission } from '@/lib/rbac';

/**
 * GET /api/notifications
 * Kullanıcının bildirimlerini listeler
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

        // Yetki kontrolü - sadece VIEW_NOTIFICATIONS izni olanlar
        if (!hasPermission(user.role, 'VIEW_NOTIFICATIONS')) {
            return NextResponse.json(
                { success: false, error: 'Bildirim görüntüleme yetkiniz yok' },
                { status: 403 }
            );
        }

        // Query parametrelerini al
        const url = new URL(request.url);
        const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        // Bildirimleri getir
        const result = await getNotificationsForUser(user.id, {
            unreadOnly,
            limit: Math.min(limit, 100), // Maksimum 100
            offset,
        });

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Bildirim listesi hatası:', error);
        return NextResponse.json(
            { success: false, error: 'Bildirimler yüklenirken bir hata oluştu' },
            { status: 500 }
        );
    }
}
