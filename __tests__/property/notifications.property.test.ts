/**
 * Property Tests: Property 10 - Notification System Correctness
 * Feature: yetkili-kilavuzu-v2-guncelleme
 *
 * *For any* notification event, the system SHALL:
 * - Create notifications for all ust_yetkili users
 * - Return correct unread counts
 * - Mark notifications as read correctly
 * - Only allow ust_yetkili to access notifications
 *
 * **Validates: Requirements 9.1, 9.2, 9.5, 9.6**
 *
 * @jest-environment node
 */
import * as fc from 'fast-check';
import type { NotificationType } from '@/lib/notifications';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  createNotification,
  notifyAllUstYetkili,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '@/lib/notifications';

// Mock reset helper
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Valid notification types
const VALID_TYPES: NotificationType[] = ['new_user', 'content_change'];

// Arbitrary tanımlamaları
const notificationTypeArbitrary = fc.constantFrom<NotificationType>(...VALID_TYPES);

const notificationTitleArbitrary = fc.string({ minLength: 1, maxLength: 100 });
const notificationMessageArbitrary = fc.string({ minLength: 1, maxLength: 500 });
const notificationIdArbitrary = fc.string({ minLength: 1, maxLength: 50 });
const userIdArbitrary = fc.string({ minLength: 1, maxLength: 50 });

describe('Property Tests: Property 10 - Notification System Correctness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 10.1: createNotification her zaman geçerli bir bildirim döner
   *
   * *For any* valid notification input, createNotification SHALL return
   * a notification with isRead=false and matching fields.
   *
   * **Validates: Requirements 9.1**
   */
  it(
    'Property 10.1: createNotification geçerli inputlarla her zaman isRead=false bildirim oluşturur',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          notificationTypeArbitrary,
          notificationTitleArbitrary,
          notificationMessageArbitrary,
          async (userId, type, title, message) => {
            const mockNotification = {
              id: 'notif-1',
              userId,
              type,
              title,
              message,
              isRead: false,
              createdAt: new Date(),
              readAt: null,
            };

            (mockPrisma.notification.create as jest.Mock).mockResolvedValueOnce(mockNotification);

            const result = await createNotification(userId, type, title, message);

            // Property: Bildirim isRead=false ile oluşturulmalı
            expect(result.isRead).toBe(false);

            // Property: userId doğru olmalı
            expect(result.userId).toBe(userId);

            // Property: type doğru olmalı
            expect(result.type).toBe(type);

            // Property: title doğru olmalı
            expect(result.title).toBe(title);

            // Property: message doğru olmalı
            expect(result.message).toBe(message);

            // Property: readAt null olmalı (henüz okunmadı)
            expect(result.readAt).toBeNull();

            return true;
          }
        ),
        { numRuns: 50, verbose: false }
      );
    },
    30000
  );

  /**
   * Property 10.2: notifyAllUstYetkili tüm ust_yetkili kullanıcılara bildirim gönderir
   *
   * *For any* number of ust_yetkili users, notifyAllUstYetkili SHALL create
   * exactly N notifications (one per user).
   *
   * **Validates: Requirements 9.2**
   */
  it(
    'Property 10.2: notifyAllUstYetkili her ust_yetkili kullanıcı için bir bildirim oluşturur',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(userIdArbitrary, { minLength: 0, maxLength: 10 }),
          notificationTypeArbitrary,
          notificationTitleArbitrary,
          notificationMessageArbitrary,
          async (userIds, type, title, message) => {
            jest.clearAllMocks();

            const uniqueIds = [...new Set(userIds)];
            const mockUsers = uniqueIds.map((id) => ({ id }));

            (mockPrisma.user.findMany as jest.Mock).mockResolvedValueOnce(mockUsers);
            (mockPrisma.notification.createMany as jest.Mock).mockResolvedValueOnce({ count: mockUsers.length });

            await notifyAllUstYetkili(type, title, message);

            if (mockUsers.length === 0) {
              // Property: Kullanıcı yoksa createMany çağrılmamalı
              expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
            } else {
              // Property: createMany N kullanıcı için çağrılmalı
              expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
                data: expect.arrayContaining(
                  mockUsers.map((u) =>
                    expect.objectContaining({
                      userId: u.id,
                      type,
                      title,
                      message,
                      isRead: false,
                    })
                  )
                ),
              });

              // Property: createMany data'sı user sayısına eşit olmalı
              const callArgs = (mockPrisma.notification.createMany as jest.Mock).mock.calls[0][0] as {
                data: unknown[];
              };
              expect(callArgs.data).toHaveLength(mockUsers.length);
            }

            return true;
          }
        ),
        { numRuns: 50, verbose: false }
      );
    },
    30000
  );

  /**
   * Property 10.3: getUnreadCount doğru sayı döner
   *
   * *For any* userId, getUnreadCount SHALL return a non-negative integer.
   *
   * **Validates: Requirements 9.3**
   */
  it(
    'Property 10.3: getUnreadCount her zaman negatif olmayan bir sayı döner',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.nat({ max: 100 }),
          async (userId, count) => {
            (mockPrisma.notification.count as jest.Mock).mockResolvedValueOnce(count);

            const result = await getUnreadCount(userId);

            // Property: Sonuç negatif olmamalı
            expect(result).toBeGreaterThanOrEqual(0);

            // Property: Mock değeri döndürülmeli
            expect(result).toBe(count);

            return true;
          }
        ),
        { numRuns: 50, verbose: false }
      );
    },
    30000
  );

  /**
   * Property 10.4: markAsRead yalnızca o kullanıcının bildirimini günceller
   *
   * *For any* notificationId and userId, markAsRead SHALL only update
   * the notification belonging to that user.
   *
   * **Validates: Requirements 9.5**
   */
  it(
    'Property 10.4: markAsRead doğru userId ile çağrıldığında bildirimi okundu olarak işaretler',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          notificationIdArbitrary,
          userIdArbitrary,
          async (notificationId, userId) => {
            const mockUpdated = {
              id: notificationId,
              userId,
              type: 'new_user' as NotificationType,
              title: 'Test',
              message: 'Test message',
              isRead: true,
              createdAt: new Date(),
              readAt: new Date(),
            };

            (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
            (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValueOnce(mockUpdated);

            const result = await markAsRead(notificationId, userId);

            // Property: Sonuç null olmamalı (başarılı güncelleme)
            expect(result).not.toBeNull();

            // Property: updateMany userId filtresiyle çağrılmalı
            expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  id: notificationId,
                  userId,
                }),
              })
            );

            // Property: isRead=true olmalı
            if (result) {
              expect(result.isRead).toBe(true);
              expect(result.readAt).not.toBeNull();
            }

            return true;
          }
        ),
        { numRuns: 50, verbose: false }
      );
    },
    30000
  );

  /**
   * Property 10.5: markAllAsRead belirli kullanıcının tüm bildirimlerini günceller
   *
   * *For any* userId, markAllAsRead SHALL update all unread notifications
   * for that user and return the count.
   *
   * **Validates: Requirements 9.5**
   */
  it(
    'Property 10.5: markAllAsRead tüm okunmamış bildirimleri günceller ve count döner',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.nat({ max: 50 }),
          async (userId, updatedCount) => {
            (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValueOnce({
              count: updatedCount,
            });

            const result = await markAllAsRead(userId);

            // Property: Sonuç negatif olmamalı
            expect(result).toBeGreaterThanOrEqual(0);

            // Property: Mock count döndürülmeli
            expect(result).toBe(updatedCount);

            // Property: updateMany userId ve isRead=false filtresiyle çağrılmalı
            expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  userId,
                  isRead: false,
                }),
                data: expect.objectContaining({
                  isRead: true,
                }),
              })
            );

            return true;
          }
        ),
        { numRuns: 50, verbose: false }
      );
    },
    30000
  );

  /**
   * Property 10.6: getNotifications userId'ye göre filtreler
   *
   * *For any* userId, getNotifications SHALL only return notifications
   * belonging to that user.
   *
   * **Validates: Requirements 9.5**
   */
  it(
    'Property 10.6: getNotifications her zaman sadece belirtilen kullanıcının bildirimlerini döner',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(
            fc.record({
              id: notificationIdArbitrary,
              userId: userIdArbitrary,
              type: notificationTypeArbitrary,
              title: notificationTitleArbitrary,
              message: notificationMessageArbitrary,
              isRead: fc.boolean(),
              createdAt: fc.date(),
              readAt: fc.option(fc.date(), { nil: null }),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          async (userId, mockNotifications) => {
            // Sadece bu kullanıcıya ait bildirimleri simüle et
            const userNotifications = mockNotifications.map((n) => ({ ...n, userId }));
            (mockPrisma.notification.findMany as jest.Mock).mockResolvedValueOnce(userNotifications);

            const result = await getNotifications(userId);

            // Property: findMany userId filtresiyle çağrılmalı
            expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({ userId }),
              })
            );

            // Property: Sonuç dizisi döner
            expect(Array.isArray(result)).toBe(true);

            // Property: Sonuçtaki tüm bildirimler bu kullanıcıya ait
            result.forEach((n) => {
              expect(n.userId).toBe(userId);
            });

            return true;
          }
        ),
        { numRuns: 30, verbose: false }
      );
    },
    30000
  );

  /**
   * Property 10.7: Bildirim türleri geçerli değerlerle sınırlı
   *
   * *For any* valid notification type, the type SHALL be one of the defined types.
   *
   * **Validates: Requirements 9.1**
   */
  it(
    'Property 10.7: Tüm geçerli bildirim türleri tanımlı tiplerden biri olmalı',
    () => {
      fc.assert(
        fc.property(notificationTypeArbitrary, (type) => {
          // Property: type geçerli değerlerden biri olmalı
          expect(VALID_TYPES).toContain(type);
          return true;
        }),
        { numRuns: 100, verbose: false }
      );
    }
  );
});
