/**
 * Bildirim Servisi
 * Bildirim oluşturma, listeleme ve yönetim işlemleri
 *
 * Requirements:
 * - Requirement 9.1: Yeni kullanıcı kaydında bildirim
 * - Requirement 9.2: Önemli içerik değişikliklerinde bildirim
 * - Requirement 9.5: Okundu olarak işaretleme
 */

import prisma from '@/lib/prisma';
import type { Notification, NotificationType } from '@/types';
import { getAllRoles } from '@/lib/roles';

/**
 * Veritabanı bildirim verisini Notification tipine dönüştürür
 */
function mapDbNotificationToNotification(dbNotification: {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    data: string;
    read: boolean;
    createdAt: Date;
}): Notification {
    return {
        id: dbNotification.id,
        userId: dbNotification.userId,
        type: dbNotification.type as NotificationType,
        title: dbNotification.title,
        message: dbNotification.message,
        data: JSON.parse(dbNotification.data),
        read: dbNotification.read,
        createdAt: dbNotification.createdAt,
    };
}

/**
 * Bildirim oluşturma input tipi
 */
export interface CreateNotificationInput {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
}

/**
 * Yeni bildirim oluşturur
 */
export async function createNotification(
    input: CreateNotificationInput
): Promise<Notification> {
    const dbNotification = await prisma.notification.create({
        data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            message: input.message,
            data: JSON.stringify(input.data || {}),
        },
    });

    return mapDbNotificationToNotification(dbNotification);
}

/**
 * Belirli rollerdeki tüm kullanıcılara bildirim oluşturur
 */
export async function createNotificationForRoles(
    roleCodes: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
): Promise<number> {
    // İlgili rollerin ID'lerini bul
    const roles = await getAllRoles();
    const roleIds = roles
        .filter((r) => roleCodes.includes(r.code))
        .map((r) => r.id);

    // Bu rollere sahip kullanıcıları bul
    const users = await prisma.user.findMany({
        where: {
            roleId: { in: roleIds },
            status: 'approved',
        },
        select: { id: true },
    });

    // Her kullanıcı için bildirim oluştur
    const notifications = users.map((user) => ({
        userId: user.id,
        type,
        title,
        message,
        data: JSON.stringify(data || {}),
    }));

    if (notifications.length === 0) {
        return 0;
    }

    const result = await prisma.notification.createMany({
        data: notifications,
    });

    return result.count;
}

/**
 * Üst yetkililer (gm_plus, owner) için bildirim oluşturur
 */
export async function createNotificationForHighRoles(
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
): Promise<number> {
    return createNotificationForRoles(['gm_plus', 'owner'], type, title, message, data);
}

/**
 * Kullanıcının bildirimlerini getirir
 */
export async function getNotificationsForUser(
    userId: string,
    options?: {
        unreadOnly?: boolean;
        limit?: number;
        offset?: number;
    }
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const { unreadOnly = false, limit = 50, offset = 0 } = options || {};

    const whereClause = {
        userId,
        ...(unreadOnly ? { read: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.notification.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return {
        notifications: notifications.map(mapDbNotificationToNotification),
        total,
        unreadCount,
    };
}

/**
 * Bildirimi okundu olarak işaretler
 */
export async function markAsRead(notificationId: string): Promise<Notification> {
    const dbNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
    });

    return mapDbNotificationToNotification(dbNotification);
}

/**
 * Kullanıcının tüm bildirimlerini okundu olarak işaretler
 */
export async function markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
    });

    return result.count;
}

/**
 * Kullanıcının okunmamış bildirim sayısını getirir
 */
export async function getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
        where: { userId, read: false },
    });
}

/**
 * Bildirimi siler
 */
export async function deleteNotification(notificationId: string): Promise<void> {
    await prisma.notification.delete({
        where: { id: notificationId },
    });
}

/**
 * Kullanıcının eski bildirimlerini temizler (30 günden eski)
 */
export async function cleanupOldNotifications(
    userId: string,
    daysOld: number = 30
): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
        where: {
            userId,
            createdAt: { lt: cutoffDate },
            read: true, // Sadece okunmuş bildirimleri sil
        },
    });

    return result.count;
}

// ============================================
// Otomatik Bildirim Tetikleyicileri
// ============================================

/**
 * Yeni kullanıcı kaydı bildirimi oluşturur
 */
export async function notifyNewUserRegistration(
    newUser: { id: string; username: string; email: string }
): Promise<number> {
    return createNotificationForHighRoles(
        'new_registration',
        'Yeni Kullanıcı Kaydı',
        `${newUser.username} (${newUser.email}) yeni kayıt oldu ve onay bekliyor.`,
        {
            userId: newUser.id,
            username: newUser.username,
            email: newUser.email,
            action: 'review_user',
            link: `/admin?search=${newUser.username}`,
        }
    );
}

/**
 * Rol değişikliği bildirimi oluşturur
 */
export async function notifyRoleChange(
    targetUser: { id: string; username: string },
    newRole: { code: string; name: string },
    changedBy: { id: string; username: string }
): Promise<number> {
    return createNotificationForHighRoles(
        'role_change',
        'Rol Değişikliği',
        `${changedBy.username} kullanıcısı ${targetUser.username} kullanıcısının rolünü ${newRole.name} olarak değiştirdi.`,
        {
            targetUserId: targetUser.id,
            targetUsername: targetUser.username,
            newRoleCode: newRole.code,
            newRoleName: newRole.name,
            changedById: changedBy.id,
            changedByUsername: changedBy.username,
        }
    );
}

/**
 * İçerik değişikliği bildirimi oluşturur
 */
export async function notifyContentChange(
    contentType: string,
    contentTitle: string,
    action: 'created' | 'updated' | 'deleted',
    changedBy: { id: string; username: string }
): Promise<number> {
    const actionLabels = {
        created: 'oluşturdu',
        updated: 'güncelledi',
        deleted: 'sildi',
    };

    return createNotificationForHighRoles(
        'content_change',
        'İçerik Değişikliği',
        `${changedBy.username} "${contentTitle}" ${contentType} içeriğini ${actionLabels[action]}.`,
        {
            contentType,
            contentTitle,
            action,
            changedById: changedBy.id,
            changedByUsername: changedBy.username,
        }
    );
}
