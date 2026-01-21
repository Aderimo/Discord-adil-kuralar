// GET /api/admin/users/pending - Bekleyen kullanıcılar listesi
// Requirement 3.1: Admin bekleyen kullanıcılar listesini görüntüler
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/api-auth';

interface PendingUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  status: string;
}

interface PendingUsersResponse {
  success: boolean;
  users?: PendingUser[];
  count?: number;
  error?: string;
}

export const GET = withAdmin<PendingUsersResponse>(async () => {
  try {
    // Tüm "pending" durumundaki kullanıcıları getir
    const pendingUsers = await prisma.user.findMany({
      where: {
        status: 'pending',
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        status: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      {
        success: true,
        users: pendingUsers,
        count: pendingUsers.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Pending users fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Bekleyen kullanıcılar getirilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
