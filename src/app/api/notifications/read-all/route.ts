/**
 * POST /api/notifications/read-all - Tüm bildirimleri okundu olarak işaretle
 *
 * Requirements:
 * - 9.5: THE System SHALL provide markAllAsRead function
 */
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api-auth';
import { markAllAsRead } from '@/lib/notifications';

export const POST = withRole(
  'ust_yetkili',
  async (_request: NextRequest, { user }) => {
    const count = await markAllAsRead(user.id);

    return NextResponse.json({
      success: true,
      markedCount: count,
    });
  }
);
