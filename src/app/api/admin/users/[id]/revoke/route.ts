// POST /api/admin/users/:id/revoke - Kullanıcı yetkisini iptal etme
// Modluktan atılan kullanıcının onayını reddeder, rolünü sıfırlar ve oturumunu sonlandırır
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, type AuthenticatedApiHandler } from '@/lib/api-auth';

interface RevokeResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const handler: AuthenticatedApiHandler<RevokeResponse> = async (
  request: NextRequest,
  { params, user: adminUser }
) => {
  try {
    const userId: string = params.id as string;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Kullanıcı ID gereklidir' }, { status: 400 });
    }

    // Kendi kendini iptal edemez
    if (userId === adminUser.id) {
      return NextResponse.json({ success: false, error: 'Kendi erişiminizi iptal edemezsiniz' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    if (targetUser.status === 'rejected' && targetUser.role === 'none') {
      return NextResponse.json({ success: false, error: 'Kullanıcının yetkisi zaten iptal edilmiş' }, { status: 400 });
    }

    // Status → rejected, role → none
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'rejected',
        role: 'none',
        updatedAt: new Date(),
      },
    });

    // Tüm oturumları sil - anlık erişim kaybı
    await prisma.session.deleteMany({ where: { userId } });

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: 'user_reject',
        details: JSON.stringify({
          event: 'access_revoked',
          targetUserId: userId,
          targetUsername: targetUser.username,
          previousStatus: targetUser.status,
          previousRole: targetUser.role,
        }),
        ipAddress: request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown',
      },
    });

    return NextResponse.json(
      { success: true, message: `${targetUser.username} kullanıcısının yetkisi iptal edildi ve oturumu sonlandırıldı` },
      { status: 200 }
    );
  } catch (error) {
    console.error('Revoke error:', error);
    return NextResponse.json({ success: false, error: 'Yetki iptali sırasında bir hata oluştu' }, { status: 500 });
  }
};

export const POST = withAdmin(handler);
