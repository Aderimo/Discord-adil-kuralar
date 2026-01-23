// PUT /api/admin/users/:id/role - Yetki seviyesi değiştirme
// Requirement 3.4: Admin yetki seviyesi değiştirir, değişiklik kaydedilir ve log oluşturulur
// Requirement 11.7: Dinamik rol atama
// Requirement 11.8: Owner rolü koruması
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, type AuthenticatedApiHandler } from '@/lib/api-auth';
import { notifyRoleChange } from '@/lib/notifications';
import { FOUNDER_EMAIL } from '@/lib/founder';

interface RoleChangeRequest {
  role: string; // Dinamik rol kodu
}

interface RoleChangeResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    status: string;
    role: string | null;
  };
  error?: string;
}

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

    const { role: newRoleCode } = body;

    // Rol kodu validasyonu
    if (!newRoleCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rol kodu belirtilmelidir',
        },
        { status: 400 }
      );
    }

    // Yeni rolü veritabanından bul
    const newRole = await prisma.role.findUnique({
      where: { code: newRoleCode },
    });

    if (!newRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçersiz rol kodu',
        },
        { status: 400 }
      );
    }

    // Owner rolü koruması - Requirement 11.8
    // Sadece mevcut owner'lar owner rolü atayabilir
    if (newRoleCode === 'owner') {
      const adminRole = await prisma.role.findFirst({
        where: { id: adminUser.roleId || '' },
      });

      if (!adminRole || adminRole.code !== 'owner') {
        return NextResponse.json(
          {
            success: false,
            error: 'Owner rolü sadece mevcut owner\'lar tarafından atanabilir',
          },
          { status: 403 }
        );
      }
    }

    // Kullanıcıyı bul
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
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

    // Founder koruması - founder'ın rolü değiştirilemez
    if (targetUser.email === FOUNDER_EMAIL) {
      return NextResponse.json(
        {
          success: false,
          error: 'Site kurucusunun rolü değiştirilemez',
        },
        { status: 403 }
      );
    }

    // Aynı rol mu kontrol et
    if (targetUser.roleId === newRole.id) {
      return NextResponse.json(
        {
          success: false,
          error: `Kullanıcı zaten ${newRole.name} yetkisine sahip`,
        },
        { status: 400 }
      );
    }

    const previousRole = targetUser.role;

    // Rolü güncelle
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        roleId: newRole.id,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        role: {
          select: {
            code: true,
            name: true,
          },
        },
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
          previousRole: previousRole?.code || null,
          previousRoleName: previousRole?.name || null,
          newRole: newRole.code,
          newRoleName: newRole.name,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
      },
    });

    // Bildirim gönder
    try {
      await notifyRoleChange(
        { id: targetUser.id, username: targetUser.username },
        { code: newRole.code, name: newRole.name },
        { id: adminUser.id, username: adminUser.username }
      );
    } catch (notificationError) {
      console.error('Bildirim gönderilemedi:', notificationError);
    }

    return NextResponse.json(
      {
        success: true,
        message: `${targetUser.username} kullanıcısının yetkisi ${previousRole?.name || 'Yok'} -> ${newRole.name} olarak değiştirildi`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          status: updatedUser.status,
          role: updatedUser.role?.code || null,
        },
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
