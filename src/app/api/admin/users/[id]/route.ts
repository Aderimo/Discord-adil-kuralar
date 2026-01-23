// GET /api/admin/users/:id - Kullanıcı detayı ve aktivite geçmişi
// Requirement 5.6: Kullanıcı detay sayfası için API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, type AuthenticatedApiHandler } from '@/lib/api-auth';
import { toAppActivityLog } from '@/lib/db';
import type { ActivityLog } from '@/types';

interface UserDetailResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    status: string;
    role: {
      id: string;
      code: string;
      name: string;
      shortName: string;
      description: string;
      hierarchy: number;
      color: string;
      permissions: string;
      isSystem: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  };
  activityLogs?: ActivityLog[];
  error?: string;
}

const handler: AuthenticatedApiHandler<UserDetailResponse> = async (
  _request: NextRequest,
  { params }
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

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kullanıcı bulunamadı',
        },
        { status: 404 }
      );
    }

    // Kullanıcının aktivite loglarını getir
    const activityLogs = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50, // Son 50 aktivite
    });

    // Ayrıca bu kullanıcıyla ilgili admin işlemlerini de getir (rol değişiklikleri vb.)
    const adminLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          {
            action: { in: ['role_change', 'user_approve', 'user_reject'] },
            details: { contains: userId },
          },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    // Tüm logları birleştir ve sırala
    const allLogs = [...activityLogs, ...adminLogs]
      .map(toAppActivityLog)
      // Duplicate'leri kaldır
      .filter((log, index, self) => 
        index === self.findIndex(l => l.id === log.id)
      )
      // Tarihe göre sırala
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    return NextResponse.json(
      {
        success: true,
        user: {
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString() || null,
        },
        activityLogs: allLogs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('User detail error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Kullanıcı bilgileri alınırken bir hata oluştu',
      },
      { status: 500 }
    );
  }
};

export const GET = withAdmin(handler);
