/**
 * Bildirim Servisi
 * Notification oluşturma, listeleme ve okundu işaretleme
 *
 * Requirements:
 * - 9.1: createNotification - yeni bildirim oluşturma
 * - 9.2: Yeni kayıt ve içerik değişikliğinde otomatik bildirim
 * - 9.5: getNotifications, markAsRead, markAllAsRead fonksiyonları
 * - 9.6: Sadece ust_yetkili bildirimleri görebilir
 */

import { prisma } from '@/lib/prisma';

export type NotificationType = 'new_user' | 'content_change';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}

/**
 * Yeni bildirim oluşturur
 * Requirement 9.1: THE System SHALL create notifications for important events
 *
 * @param userId - Bildirimi alacak kullanıcı ID (ust_yetkili)
 * @param type - Bildirim türü (new_user | content_change)
 * @param title - Bildirim başlığı
 * @param message - Bildirim içeriği
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string
): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      isRead: false,
    },
  });

  return notification as Notification;
}

/**
 * Tüm ust_yetkili kullanıcılarına bildirim gönderir
 * Requirement 9.2: Notifications SHALL be sent to all ust_yetkili users
 *
 * @param type - Bildirim türü
 * @param title - Bildirim başlığı
 * @param message - Bildirim içeriği
 */
export async function notifyAllUstYetkili(
  type: NotificationType,
  title: string,
  message: string
): Promise<void> {
  const ustYetkiliUsers = await prisma.user.findMany({
    where: {
      role: 'ust_yetkili',
      status: 'approved',
    },
    select: { id: true },
  });

  if (ustYetkiliUsers.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: ustYetkiliUsers.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      isRead: false,
    })),
  });
}

/**
 * Kullanıcının bildirimlerini getirir
 * Requirement 9.5: THE System SHALL provide getNotifications function
 *
 * @param userId - Kullanıcı ID
 * @param onlyUnread - Sadece okunmamış bildirimler (default: false)
 * @param limit - Maksimum bildirim sayısı (default: 50)
 */
export async function getNotifications(
  userId: string,
  onlyUnread = false,
  limit = 50
): Promise<Notification[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      ...(onlyUnread ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return notifications as Notification[];
}

/**
 * Okunmamış bildirim sayısını getirir
 * Requirement 9.3: Badge sayısı için unread count
 *
 * @param userId - Kullanıcı ID
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

/**
 * Bildirimi okundu olarak işaretler
 * Requirement 9.5: THE System SHALL provide markAsRead function
 *
 * @param notificationId - Bildirim ID
 * @param userId - Kullanıcı ID (güvenlik doğrulaması için)
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (notification.count === 0) {
      return null;
    }

    return prisma.notification.findUnique({
      where: { id: notificationId },
    }) as Promise<Notification | null>;
  } catch {
    return null;
  }
}

/**
 * Kullanıcının tüm bildirimlerini okundu olarak işaretler
 * Requirement 9.5: THE System SHALL provide markAllAsRead function
 *
 * @param userId - Kullanıcı ID
 * @returns Güncellenen bildirim sayısı
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result.count;
}
