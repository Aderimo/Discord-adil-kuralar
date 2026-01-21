// POST /api/admin/users/:id/reject - Kullanıcı reddetme
// Requirement 3.3: Admin bir kullanıcıyı reddeder, durum "Reddedildi" olur
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, type AuthenticatedApiHandler } from '@/lib/api-auth';

interface RejectRequest {
  reason?: string;
}

interface RejectResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    status: string;
  };
  error?: string;
}

const handler: AuthenticatedApiHandler<RejectResponse> = async (
  request: NextRequest,
  { params, user: adminUser }
) => {
  try {
    const userId: string = params.id as string;

    // userId validasyonu
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kullanıcı ID gereklidir',
        },
        { status: 400 }
      );
    }

    // Opsiyonel red sebebi
    let reason: string | undefined;
    try {
      const body: RejectRequest = await request.json();
      reason = body.reason;
    } catch {
      // Body boş olabilir, sorun değil
    }

    // Kullanıcıyı bul
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kullanıcı bulunamadı',
        },
        { status: 404 }
      );
    }

    // Zaten reddedilmiş mi kontrol et
    if (targetUser.status === 'rejected') {
      return NextResponse.json(
        {
          success: false,
          error: 'Kullanıcı zaten reddedilmiş durumda',
        },
        { status: 400 }
      );
    }

    // Kullanıcıyı reddet
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'rejected',
        role: 'none', // Rol sıfırla
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
      },
    });

    // Activity log oluştur - Requirement 3.4
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: 'user_reject',
        details: JSON.stringify({
          targetUserId: userId,
          targetUsername: targetUser.username,
          previousStatus: targetUser.status,
          previousRole: targetUser.role,
          reason: reason || 'Sebep belirtilmedi',
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `${targetUser.username} kullanıcısının başvurusu reddedildi`,
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('User reject error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Kullanıcı reddetme işlemi sırasında bir hata oluştu',
      },
      { status: 500 }
    );
  }
};

export const POST = withAdmin(handler);
