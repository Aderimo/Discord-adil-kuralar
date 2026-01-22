// GET /api/admin/users - Tüm kullanıcıları listele (filtreleme destekli)
// Requirements: 5.1, 5.2, 5.3 - Admin panelinde kullanıcı listesi, arama ve filtreleme
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/api-auth';
import type { UserRole, UserStatus } from '@/types';

interface UserListItem {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

interface UserListResponse {
  success: boolean;
  users?: UserListItem[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  error?: string;
}

// Geçerli status değerleri
const VALID_STATUSES: UserStatus[] = ['pending', 'approved', 'rejected'];

// Geçerli rol değerleri (filtreleme için)
const VALID_ROLES: UserRole[] = ['mod', 'admin', 'ust_yetkili'];

/**
 * GET /api/admin/users
 * 
 * Query Parameters:
 * - search: Kullanıcı adı veya email ile arama (opsiyonel)
 * - status: Durum filtresi - pending, approved, rejected (opsiyonel)
 * - role: Rol filtresi - mod, admin, ust_yetkili (opsiyonel)
 * - page: Sayfa numarası (varsayılan: 1)
 * - pageSize: Sayfa başına kayıt (varsayılan: 10, max: 100)
 * 
 * Response:
 * - users: Kullanıcı listesi
 * - pagination: Sayfalama bilgileri
 * - stats: İstatistikler (toplam, bekleyen, onaylı, reddedilen)
 */
export const GET = withAdmin<UserListResponse>(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    
    // Query parametrelerini al
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') as UserStatus | null;
    const role = searchParams.get('role') as UserRole | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
    
    // Status validasyonu
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Geçersiz status değeri. Geçerli değerler: ${VALID_STATUSES.join(', ')}`,
        },
        { status: 400 }
      );
    }
    
    // Role validasyonu
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Geçersiz role değeri. Geçerli değerler: ${VALID_ROLES.join(', ')}`,
        },
        { status: 400 }
      );
    }
    
    // Prisma where koşullarını oluştur
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereConditions: any = {};
    
    // Arama filtresi - username veya email'de ara
    // Requirement 5.2: Kullanıcı adı veya email ile arama
    if (search) {
      whereConditions.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Status filtresi
    // Requirement 5.3: Durum filtresi
    if (status) {
      whereConditions.status = status;
    }
    
    // Role filtresi
    // Requirement 5.3: Rol filtresi
    if (role) {
      whereConditions.role = role;
    }
    
    // Toplam kayıt sayısını al (pagination için)
    const total = await prisma.user.count({
      where: whereConditions,
    });
    
    // Kullanıcıları getir
    const users = await prisma.user.findMany({
      where: whereConditions,
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
      orderBy: [
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    
    // İstatistikleri hesapla
    // Requirement 5.7: Kullanıcı sayısı istatistikleri
    const [pendingCount, approvedCount, rejectedCount, totalCount] = await Promise.all([
      prisma.user.count({ where: { status: 'pending' } }),
      prisma.user.count({ where: { status: 'approved' } }),
      prisma.user.count({ where: { status: 'rejected' } }),
      prisma.user.count(),
    ]);
    
    const totalPages = Math.ceil(total / pageSize);
    
    return NextResponse.json(
      {
        success: true,
        users: users as UserListItem[],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
        stats: {
          total: totalCount,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Users list fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Kullanıcılar getirilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
