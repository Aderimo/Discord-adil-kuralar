// POST /api/admin/users/:id/approve - Kullanıcı onaylama
// Requirement 3.2: Admin bir kullanıcıyı onaylar, durum "Onaylı" olur ve yetki seviyesi atanır
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, type AuthenticatedApiHandler } from '@/lib/api-auth';
import type { UserRole } from '@/types';

interface ApproveRequest {
  role: 'mod' | 'admin' | 'ust_yetkili';
}

interface ApproveResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    status: string;
    role: string;
  };
  error?: string;
}

// Geçerli roller
const VALID_ROLES: UserRole[] = ['mod', 'admin', 'ust_yetkili'];

const handler: AuthenticatedApiHandler<ApproveResponse> = async (
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

    // Request body'den rol bilgisini al
    let body: ApproveRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçersiz istek formatı',
        },
        { status: 400 }
      );
    }

    const { role } = body;

    // Rol validasyonu
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçerli bir yetki seviyesi belirtilmelidir (mod, admin, ust_yetkili)',
        },
        { status: 400 }
      );
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

    // Zaten onaylı mı kontrol et
    if (targetUser.status === 'approved') {
      return NextResponse.json(
        {
          success: false,
          error: 'Kullanıcı zaten onaylı durumda',
        },
        { status: 400 }
      );
    }

    // Kullanıcıyı onayla ve rol ata
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'approved',
        role: role,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        role: true,
      },
    });

    // Activity log oluştur - Requirement 3.4
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: 'user_approve',
        details: JSON.stringify({
          targetUserId: userId,
          targetUsername: targetUser.username,
          assignedRole: role,
          previousStatus: targetUser.status,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `${targetUser.username} kullanıcısı ${role} yetkisiyle onaylandı`,
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('User approve error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Kullanıcı onaylama işlemi sırasında bir hata oluştu',
      },
      { status: 500 }
    );
  }
};

export const POST = withAdmin(handler);
