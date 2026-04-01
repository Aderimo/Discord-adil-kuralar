/**
 * GET /api/notifications - Kullanıcının bildirimlerini listele
 *
 * Requirements:
 * - 9.4: THE System SHALL provide GET endpoint for notification list
 * - 9.6: Sadece ust_yetkili kullanıcılar bildirim görebilir
 */
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api-auth';
import { getNotifications, getUnreadCount } from '@/lib/notifications';

export const GET = withRole(
  'ust_yetkili',
  async (_request: NextRequest, { user }) => {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(user.id),
      getUnreadCount(user.id),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  }
);
