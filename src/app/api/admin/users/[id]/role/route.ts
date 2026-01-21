// PUT /api/admin/users/:id/role - Yetki seviyesi değiştirme
// Requirement 3.4: Admin yetki seviyesi değiştirir, değişiklik kaydedilir ve log oluşturulur
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, type AuthenticatedApiHandler } from '@/lib/api-auth';
import type { UserRole } from '@/types';

interface RoleChangeRequest {
  role: 'mod' | 'admin' | 'ust_yetkili';
}

interface RoleChangeResponse {
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

const handler: AuthenticatedApiHandler<RoleChangeResponse> = async (
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

    // Request body'den yeni rol bilgisini al
    let body: RoleChangeRequest;
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

    const { role: newRole } = body;

    // Rol validasyonu
    if (!newRole || !VALID_ROLES.includes(newRole)) {
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

    // Sadece onaylı kullanıcıların rolü değiştirilebilir
    if (targetUser.status !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          error: 'Sadece onaylı kullanıcıların yetki seviyesi değiştirilebilir',
        },
        { status: 400 }
      );
    }

    // Aynı rol mu kontrol et
    if (targetUser.role === newRole) {
      return NextResponse.json(
        {
          success: false,
          error: `Kullanıcı zaten ${newRole} yetkisine sahip`,
        },
        { status: 400 }
      );
    }

    const previousRole = targetUser.role;

    // Rolü güncelle
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
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
        action: 'role_change',
        details: JSON.stringify({
          targetUserId: userId,
          targetUsername: targetUser.username,
          previousRole: previousRole,
          newRole: newRole,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `${targetUser.username} kullanıcısının yetkisi ${previousRole} -> ${newRole} olarak değiştirildi`,
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Role change error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Yetki değiştirme işlemi sırasında bir hata oluştu',
      },
      { status: 500 }
    );
  }
};

export const PUT = withAdmin(handler);
