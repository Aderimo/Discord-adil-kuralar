// POST /api/admin/users/bulk - Toplu kullanıcı işlemleri
// Requirement 5.5: THE System SHALL support bulk operations for approving/rejecting multiple users
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, type AuthenticatedApiHandler } from '@/lib/api-auth';
import { canManageOwnerRole } from '@/lib/founder';
import type { UserRole } from '@/types';

/**
 * Toplu işlem request body tipi
 */
interface BulkActionRequest {
  userIds: string[];
  action: 'approve' | 'reject';
  role?: UserRole; // Sadece approve için gerekli
  reason?: string; // Sadece reject için opsiyonel
}

/**
 * Toplu işlem sonuç tipi
 */
interface BulkActionResult {
  userId: string;
  username: string;
  success: boolean;
  error?: string;
}

/**
 * Toplu işlem response tipi
 */
interface BulkActionResponse {
  success: boolean;
  message: string;
  results: BulkActionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  error?: string;
}

// Geçerli roller - dinamik rol sistemi ile güncellenmiş
const VALID_ROLES: UserRole[] = ['reg', 'op', 'gk', 'council', 'gm', 'gm_plus', 'owner', 'mod', 'admin', 'ust_yetkili'];

/**
 * IP adresini request'ten çıkarır
 */
function getIpAddress(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

const handler: AuthenticatedApiHandler<BulkActionResponse> = async (
  request: NextRequest,
  { user: adminUser }
) => {
  try {
    // Request body'yi parse et
    let body: BulkActionRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: 'Geçersiz istek formatı',
          results: [],
          summary: { total: 0, successful: 0, failed: 0 },
          error: 'Geçersiz JSON formatı',
        },
        { status: 400 }
      );
    }

    const { userIds, action, role, reason } = body;

    // userIds validasyonu
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'En az bir kullanıcı ID\'si gereklidir',
          results: [],
          summary: { total: 0, successful: 0, failed: 0 },
          error: 'userIds boş veya geçersiz',
        },
        { status: 400 }
      );
    }

    // Maksimum 100 kullanıcı limiti
    if (userIds.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: 'Tek seferde en fazla 100 kullanıcı işlenebilir',
          results: [],
          summary: { total: userIds.length, successful: 0, failed: 0 },
          error: 'Kullanıcı limiti aşıldı',
        },
        { status: 400 }
      );
    }

    // action validasyonu
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Geçerli bir işlem belirtilmelidir (approve veya reject)',
          results: [],
          summary: { total: userIds.length, successful: 0, failed: 0 },
          error: 'Geçersiz action',
        },
        { status: 400 }
      );
    }

    // Approve için rol validasyonu
    if (action === 'approve') {
      if (!role || !VALID_ROLES.includes(role)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Onaylama işlemi için geçerli bir rol belirtilmelidir',
            results: [],
            summary: { total: userIds.length, successful: 0, failed: 0 },
            error: 'Geçersiz veya eksik rol',
          },
          { status: 400 }
        );
      }

      // Owner rolü kontrolü - sadece founder atayabilir
      if (!canManageOwnerRole(adminUser.email, role)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Owner rolünü sadece site kurucusu atayabilir',
            results: [],
            summary: { total: userIds.length, successful: 0, failed: 0 },
            error: 'Yetkisiz işlem',
          },
          { status: 403 }
        );
      }
    }

    // Tüm kullanıcıları bul
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        role: true,
      },
    });

    // Bulunan kullanıcı ID'lerini set olarak tut
    const foundUserIds = new Set(users.map((u) => u.id));

    // Sonuçları topla
    const results: BulkActionResult[] = [];
    const ipAddress = getIpAddress(request);

    // Her kullanıcı için işlem yap
    for (const userId of userIds) {
      // Kullanıcı bulunamadı
      if (!foundUserIds.has(userId)) {
        results.push({
          userId,
          username: 'Bilinmiyor',
          success: false,
          error: 'Kullanıcı bulunamadı',
        });
        continue;
      }

      const targetUser = users.find((u) => u.id === userId)!;

      try {
        if (action === 'approve') {
          // Zaten onaylı mı kontrol et
          if (targetUser.status === 'approved') {
            results.push({
              userId,
              username: targetUser.username,
              success: false,
              error: 'Kullanıcı zaten onaylı durumda',
            });
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          // Kullanıcıyı onayla - roleId relation ile
          await (prisma.user.update as any)({
            where: { id: userId },
            data: {
              status: 'approved',
              // Rol kodunu roleId'ye çevirmek için rol tablosundan bul
              role: {
                connect: { code: role! },
              },
              updatedAt: new Date(),
            },
          });

          // Activity log oluştur
          await prisma.activityLog.create({
            data: {
              userId: adminUser.id,
              action: 'user_approve',
              details: JSON.stringify({
                event: 'bulk_user_approve',
                targetUserId: userId,
                targetUsername: targetUser.username,
                assignedRole: role,
                previousStatus: targetUser.status,
                bulkOperation: true,
              }),
              ipAddress,
            },
          });

          results.push({
            userId,
            username: targetUser.username,
            success: true,
          });
        } else {
          // Reject işlemi
          // Zaten reddedilmiş mi kontrol et
          if (targetUser.status === 'rejected') {
            results.push({
              userId,
              username: targetUser.username,
              success: false,
              error: 'Kullanıcı zaten reddedilmiş durumda',
            });
            continue;
          }

          // Kullanıcıyı reddet - roleId null yap
          await prisma.user.update({
            where: { id: userId },
            data: {
              status: 'rejected',
              roleId: null,
              updatedAt: new Date(),
            },
          });

          // Activity log oluştur
          await prisma.activityLog.create({
            data: {
              userId: adminUser.id,
              action: 'user_reject',
              details: JSON.stringify({
                event: 'bulk_user_reject',
                targetUserId: userId,
                targetUsername: targetUser.username,
                previousStatus: targetUser.status,
                previousRole: targetUser.role,
                reason: reason || 'Toplu işlem ile reddedildi',
                bulkOperation: true,
              }),
              ipAddress,
            },
          });

          results.push({
            userId,
            username: targetUser.username,
            success: true,
          });
        }
      } catch (error) {
        console.error(`Bulk operation error for user ${userId}:`, error);
        results.push({
          userId,
          username: targetUser.username,
          success: false,
          error: 'İşlem sırasında bir hata oluştu',
        });
      }
    }

    // Özet hesapla
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const actionText = action === 'approve' ? 'onaylandı' : 'reddedildi';
    const message =
      successful === userIds.length
        ? `Tüm kullanıcılar başarıyla ${actionText}`
        : `${successful}/${userIds.length} kullanıcı ${actionText}`;

    return NextResponse.json(
      {
        success: failed === 0,
        message,
        results,
        summary: {
          total: userIds.length,
          successful,
          failed,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Toplu işlem sırasında bir hata oluştu',
        results: [],
        summary: { total: 0, successful: 0, failed: 0 },
        error: 'Sunucu hatası',
      },
      { status: 500 }
    );
  }
};

export const POST = withAdmin(handler);
