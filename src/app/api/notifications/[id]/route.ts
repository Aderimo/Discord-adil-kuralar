/**
 * PUT /api/notifications/[id] - Bildirimi okundu olarak işaretle
 *
 * Requirements:
 * - 9.4: THE System SHALL provide PUT endpoint to mark notification as read
 * - 9.5: markAsRead functionality
 */
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api-auth';
import { markAsRead } from '@/lib/notifications';

export const PUT = withRole(
  'ust_yetkili',
  async (_request: NextRequest, { params, user }) => {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Bildirim ID gerekli' },
        { status: 400 }
      );
    }

    const notification = await markAsRead(id, user.id);

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Bildirim bulunamadı veya zaten okundu' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, notification });
  }
);
