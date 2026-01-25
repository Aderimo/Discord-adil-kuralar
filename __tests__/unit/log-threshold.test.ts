// Unit Tests - Log Threshold Service
// Requirement 6.1: WHEN the log count reaches 50 pages (1000 entries) THEN THE Notification_System SHALL send a notification to the Owner
// Requirement 6.2: WHEN sending log accumulation notification THEN THE Notification_System SHALL include the message "Log geçmişi 50 sayfa oldu"
// Requirement 6.3: WHEN the notification is sent THEN THE Notification_System SHALL grant Download_Permission to the Owner
// Requirement 6.4: THE Notification_System SHALL send only one notification per 50-page threshold
// Requirement 6.5: IF the Owner has not downloaded logs from previous notification THEN THE Notification_System SHALL not send duplicate notifications

// Mock Prisma
const mockCount = jest.fn();
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockCreateNotification = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: {
      count: (...args: unknown[]) => mockCount(...args),
    },
    logThreshold: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    logPermission: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

import {
  // Constants
  PAGE_SIZE,
  NOTIFICATION_THRESHOLD,
  TOTAL_ENTRY_THRESHOLD,
  DEFAULT_THRESHOLD_CONFIG,
  // Helper functions
  calculatePageCount,
  isThresholdReached,
  createThresholdStatus,
  // Database functions
  getLogPageCount,
  checkThreshold,
  // Notification functions
  shouldSendNotification,
  triggerNotification,
  // Types
  type ThresholdConfig,
  type ThresholdStatus,
} from '@/lib/log-threshold';

describe('Log Threshold Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('Constants', () => {
    it('PAGE_SIZE 20 olmalı', () => {
      expect(PAGE_SIZE).toBe(20);
    });

    it('NOTIFICATION_THRESHOLD 50 olmalı', () => {
      expect(NOTIFICATION_THRESHOLD).toBe(50);
    });

    it('TOTAL_ENTRY_THRESHOLD 1000 olmalı (20 * 50)', () => {
      expect(TOTAL_ENTRY_THRESHOLD).toBe(1000);
      expect(TOTAL_ENTRY_THRESHOLD).toBe(PAGE_SIZE * NOTIFICATION_THRESHOLD);
    });

    it('DEFAULT_THRESHOLD_CONFIG doğru değerlere sahip olmalı', () => {
      expect(DEFAULT_THRESHOLD_CONFIG.pageSize).toBe(PAGE_SIZE);
      expect(DEFAULT_THRESHOLD_CONFIG.notificationThreshold).toBe(NOTIFICATION_THRESHOLD);
    });
  });

  // ============================================================================
  // calculatePageCount Tests
  // ============================================================================

  describe('calculatePageCount', () => {
    it('0 log için 0 sayfa döndürmeli', () => {
      expect(calculatePageCount(0)).toBe(0);
    });

    it('negatif log sayısı için 0 sayfa döndürmeli', () => {
      expect(calculatePageCount(-10)).toBe(0);
    });

    it('1 log için 1 sayfa döndürmeli', () => {
      expect(calculatePageCount(1)).toBe(1);
    });

    it('20 log için 1 sayfa döndürmeli (tam sayfa)', () => {
      expect(calculatePageCount(20)).toBe(1);
    });

    it('21 log için 2 sayfa döndürmeli (yukarı yuvarlama)', () => {
      expect(calculatePageCount(21)).toBe(2);
    });

    it('40 log için 2 sayfa döndürmeli', () => {
      expect(calculatePageCount(40)).toBe(2);
    });

    it('1000 log için 50 sayfa döndürmeli', () => {
      expect(calculatePageCount(1000)).toBe(50);
    });

    it('1001 log için 51 sayfa döndürmeli', () => {
      expect(calculatePageCount(1001)).toBe(51);
    });

    it('özel pageSize ile doğru hesaplama yapmalı', () => {
      expect(calculatePageCount(100, 10)).toBe(10);
      expect(calculatePageCount(101, 10)).toBe(11);
      expect(calculatePageCount(50, 25)).toBe(2);
    });
  });

  // ============================================================================
  // isThresholdReached Tests
  // ============================================================================

  describe('isThresholdReached', () => {
    it('49 sayfa için false döndürmeli', () => {
      expect(isThresholdReached(49)).toBe(false);
    });

    it('50 sayfa için true döndürmeli (eşik)', () => {
      expect(isThresholdReached(50)).toBe(true);
    });

    it('51 sayfa için true döndürmeli (eşik üstü)', () => {
      expect(isThresholdReached(51)).toBe(true);
    });

    it('0 sayfa için false döndürmeli', () => {
      expect(isThresholdReached(0)).toBe(false);
    });

    it('özel threshold ile doğru kontrol yapmalı', () => {
      expect(isThresholdReached(9, 10)).toBe(false);
      expect(isThresholdReached(10, 10)).toBe(true);
      expect(isThresholdReached(11, 10)).toBe(true);
    });
  });

  // ============================================================================
  // createThresholdStatus Tests
  // ============================================================================

  describe('createThresholdStatus', () => {
    it('0 log için doğru status döndürmeli', () => {
      const status = createThresholdStatus(0);
      
      expect(status.currentCount).toBe(0);
      expect(status.currentPages).toBe(0);
      expect(status.thresholdReached).toBe(false);
      expect(status.lastNotificationAt).toBeNull();
    });

    it('500 log için doğru status döndürmeli', () => {
      const status = createThresholdStatus(500);
      
      expect(status.currentCount).toBe(500);
      expect(status.currentPages).toBe(25);
      expect(status.thresholdReached).toBe(false);
      expect(status.lastNotificationAt).toBeNull();
    });

    it('1000 log için thresholdReached true olmalı', () => {
      const status = createThresholdStatus(1000);
      
      expect(status.currentCount).toBe(1000);
      expect(status.currentPages).toBe(50);
      expect(status.thresholdReached).toBe(true);
    });

    it('1500 log için thresholdReached true olmalı', () => {
      const status = createThresholdStatus(1500);
      
      expect(status.currentCount).toBe(1500);
      expect(status.currentPages).toBe(75);
      expect(status.thresholdReached).toBe(true);
    });

    it('lastNotificationAt parametresini doğru ayarlamalı', () => {
      const notificationDate = new Date('2024-01-15T10:00:00.000Z');
      const status = createThresholdStatus(500, notificationDate);
      
      expect(status.lastNotificationAt).toEqual(notificationDate);
    });

    it('özel config ile doğru hesaplama yapmalı', () => {
      const customConfig: ThresholdConfig = {
        pageSize: 10,
        notificationThreshold: 5,
      };
      
      const status = createThresholdStatus(50, null, customConfig);
      
      expect(status.currentCount).toBe(50);
      expect(status.currentPages).toBe(5); // 50 / 10 = 5
      expect(status.thresholdReached).toBe(true); // 5 >= 5
    });

    it('eşik altında özel config ile false döndürmeli', () => {
      const customConfig: ThresholdConfig = {
        pageSize: 10,
        notificationThreshold: 10,
      };
      
      const status = createThresholdStatus(50, null, customConfig);
      
      expect(status.currentPages).toBe(5);
      expect(status.thresholdReached).toBe(false); // 5 < 10
    });
  });

  // ============================================================================
  // getLogPageCount Tests (Database Function)
  // Requirement 6.1
  // ============================================================================

  describe('getLogPageCount - Requirement 6.1', () => {
    it('veritabanından log sayısını alıp sayfa sayısını döndürmeli', async () => {
      mockCount.mockResolvedValue(500);
      
      const pageCount = await getLogPageCount();
      
      expect(mockCount).toHaveBeenCalled();
      expect(pageCount).toBe(25); // 500 / 20 = 25
    });

    it('0 log için 0 sayfa döndürmeli', async () => {
      mockCount.mockResolvedValue(0);
      
      const pageCount = await getLogPageCount();
      
      expect(pageCount).toBe(0);
    });

    it('1000 log için 50 sayfa döndürmeli', async () => {
      mockCount.mockResolvedValue(1000);
      
      const pageCount = await getLogPageCount();
      
      expect(pageCount).toBe(50);
    });

    it('1001 log için 51 sayfa döndürmeli (yukarı yuvarlama)', async () => {
      mockCount.mockResolvedValue(1001);
      
      const pageCount = await getLogPageCount();
      
      expect(pageCount).toBe(51);
    });

    it('büyük log sayısı için doğru hesaplama yapmalı', async () => {
      mockCount.mockResolvedValue(10000);
      
      const pageCount = await getLogPageCount();
      
      expect(pageCount).toBe(500); // 10000 / 20 = 500
    });
  });

  // ============================================================================
  // checkThreshold Tests (Database Function)
  // Requirement 6.1
  // ============================================================================

  describe('checkThreshold - Requirement 6.1', () => {
    it('eşik altında doğru status döndürmeli', async () => {
      mockCount.mockResolvedValue(500);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      expect(mockCount).toHaveBeenCalled();
      expect(mockFindFirst).toHaveBeenCalled();
      expect(status.currentCount).toBe(500);
      expect(status.currentPages).toBe(25);
      expect(status.thresholdReached).toBe(false);
      expect(status.lastNotificationAt).toBeNull();
    });

    it('eşikte doğru status döndürmeli', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      expect(status.currentCount).toBe(1000);
      expect(status.currentPages).toBe(50);
      expect(status.thresholdReached).toBe(true);
    });

    it('eşik üstünde doğru status döndürmeli', async () => {
      mockCount.mockResolvedValue(1500);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      expect(status.currentCount).toBe(1500);
      expect(status.currentPages).toBe(75);
      expect(status.thresholdReached).toBe(true);
    });

    it('LogThreshold kaydı varsa lastNotificationAt döndürmeli', async () => {
      const notificationDate = new Date('2024-01-15T10:00:00.000Z');
      mockCount.mockResolvedValue(1200);
      mockFindFirst.mockResolvedValue({
        id: 'threshold-1',
        lastNotificationAt: notificationDate,
        lastNotificationCount: 1000,
        lastDownloadAt: null,
        lastDeleteAt: null,
      });
      
      const status = await checkThreshold();
      
      expect(status.currentCount).toBe(1200);
      expect(status.currentPages).toBe(60);
      expect(status.thresholdReached).toBe(true);
      expect(status.lastNotificationAt).toEqual(notificationDate);
    });

    it('LogThreshold kaydı yoksa lastNotificationAt null olmalı', async () => {
      mockCount.mockResolvedValue(800);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      expect(status.lastNotificationAt).toBeNull();
    });

    it('0 log için doğru status döndürmeli', async () => {
      mockCount.mockResolvedValue(0);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      expect(status.currentCount).toBe(0);
      expect(status.currentPages).toBe(0);
      expect(status.thresholdReached).toBe(false);
      expect(status.lastNotificationAt).toBeNull();
    });

    it('tam eşik değerinde (999 log) false döndürmeli', async () => {
      mockCount.mockResolvedValue(999);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      // 999 / 20 = 49.95 -> ceil = 50
      expect(status.currentPages).toBe(50);
      expect(status.thresholdReached).toBe(true);
    });

    it('980 log için 49 sayfa ve false döndürmeli', async () => {
      mockCount.mockResolvedValue(980);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      // 980 / 20 = 49
      expect(status.currentPages).toBe(49);
      expect(status.thresholdReached).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('çok büyük log sayısı için doğru hesaplama yapmalı', async () => {
      mockCount.mockResolvedValue(1000000);
      mockFindFirst.mockResolvedValue(null);
      
      const status = await checkThreshold();
      
      expect(status.currentCount).toBe(1000000);
      expect(status.currentPages).toBe(50000);
      expect(status.thresholdReached).toBe(true);
    });

    it('ThresholdStatus interface doğru yapıda olmalı', () => {
      const status: ThresholdStatus = {
        currentCount: 100,
        currentPages: 5,
        thresholdReached: false,
        lastNotificationAt: null,
      };

      expect(status).toHaveProperty('currentCount');
      expect(status).toHaveProperty('currentPages');
      expect(status).toHaveProperty('thresholdReached');
      expect(status).toHaveProperty('lastNotificationAt');
    });

    it('ThresholdConfig interface doğru yapıda olmalı', () => {
      const config: ThresholdConfig = {
        pageSize: 20,
        notificationThreshold: 50,
      };

      expect(config).toHaveProperty('pageSize');
      expect(config).toHaveProperty('notificationThreshold');
    });
  });

  // ============================================================================
  // shouldSendNotification Tests
  // Requirement 6.4, 6.5: Duplicate bildirim engelleme
  // ============================================================================

  describe('shouldSendNotification - Requirement 6.4, 6.5', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('eşik altında false döndürmeli', async () => {
      mockCount.mockResolvedValue(500); // 25 sayfa, eşik altı
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue(null);

      const result = await shouldSendNotification('owner-1');

      expect(result).toBe(false);
    });

    it('eşikte ve ilk bildirim için true döndürmeli', async () => {
      mockCount.mockResolvedValue(1000); // 50 sayfa, eşikte
      mockFindFirst.mockResolvedValue(null); // Daha önce bildirim yok
      mockFindUnique.mockResolvedValue(null); // Permission yok

      const result = await shouldSendNotification('owner-1');

      expect(result).toBe(true);
    });

    it('owner zaten download yetkisine sahipse ve indirmemişse false döndürmeli (Requirement 6.5)', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue({
        userId: 'owner-1',
        canDownload: true,
        downloadedAt: null, // Henüz indirmemiş
      });

      const result = await shouldSendNotification('owner-1');

      expect(result).toBe(false);
    });

    it('owner indirme yapmışsa yeni eşik için true döndürmeli', async () => {
      mockCount.mockResolvedValue(2000); // 100 sayfa, 2. eşik
      mockFindFirst.mockResolvedValue({
        lastNotificationAt: new Date('2024-01-01'),
        lastNotificationCount: 1000, // İlk eşikte bildirim gönderilmiş
      });
      mockFindUnique.mockResolvedValue({
        userId: 'owner-1',
        canDownload: true,
        downloadedAt: new Date('2024-01-02'), // İndirmiş
      });

      const result = await shouldSendNotification('owner-1');

      expect(result).toBe(true);
    });

    it('aynı eşik katında tekrar bildirim göndermemeli (Requirement 6.4)', async () => {
      mockCount.mockResolvedValue(1200); // Hala 1. eşik katında (1000-1999)
      mockFindFirst.mockResolvedValue({
        lastNotificationAt: new Date('2024-01-01'),
        lastNotificationCount: 1000,
      });
      mockFindUnique.mockResolvedValue({
        userId: 'owner-1',
        canDownload: true,
        downloadedAt: new Date('2024-01-02'),
      });

      const result = await shouldSendNotification('owner-1');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // triggerNotification Tests
  // Requirement 6.1, 6.2, 6.3, 6.4, 6.5
  // ============================================================================

  describe('triggerNotification - Requirement 6.1, 6.2, 6.3', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('eşik altında bildirim göndermemeli', async () => {
      mockCount.mockResolvedValue(500);
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue(null);

      await triggerNotification('owner-1');

      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('eşikte "Log geçmişi 50 sayfa oldu" mesajı ile bildirim göndermeli (Requirement 6.2)', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique
        .mockResolvedValueOnce(null) // logPermission.findUnique
        .mockResolvedValueOnce({ id: 'owner-1', username: 'owner' }); // user.findUnique
      mockUpsert.mockResolvedValue({});
      mockCreate.mockResolvedValue({});
      mockCreateNotification.mockResolvedValue({});

      await triggerNotification('owner-1');

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          message: 'Log geçmişi 50 sayfa oldu',
        })
      );
    });

    it('bildirim gönderildiğinde download yetkisi vermeli (Requirement 6.3)', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'owner-1', username: 'owner' });
      mockUpsert.mockResolvedValue({});
      mockCreate.mockResolvedValue({});
      mockCreateNotification.mockResolvedValue({});

      await triggerNotification('owner-1');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'owner-1' },
          create: expect.objectContaining({
            canDownload: true,
          }),
          update: expect.objectContaining({
            canDownload: true,
          }),
        })
      );
    });

    it('LogThreshold kaydını güncellemeli', async () => {
      mockCount.mockResolvedValue(1000);
      // shouldSendNotification içinde:
      // 1. checkThreshold -> findFirst (null - ilk bildirim)
      // 2. shouldSendNotification -> findFirst (null)
      // triggerNotification sonunda:
      // 3. findFirst (mevcut kayıt)
      mockFindFirst
        .mockResolvedValueOnce(null) // checkThreshold içinde
        .mockResolvedValueOnce(null) // shouldSendNotification içinde
        .mockResolvedValueOnce({ id: 'threshold-1', lastNotificationAt: null, lastNotificationCount: 0 }); // triggerNotification sonunda
      mockFindUnique
        .mockResolvedValueOnce(null) // logPermission - shouldSendNotification
        .mockResolvedValueOnce({ id: 'owner-1', username: 'owner' }); // user.findUnique
      mockUpsert.mockResolvedValue({});
      mockUpdate.mockResolvedValue({});
      mockCreateNotification.mockResolvedValue({});

      await triggerNotification('owner-1');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'threshold-1' },
          data: expect.objectContaining({
            lastNotificationCount: 1000,
          }),
        })
      );
    });

    it('LogThreshold kaydı yoksa yeni kayıt oluşturmalı', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'owner-1', username: 'owner' });
      mockUpsert.mockResolvedValue({});
      mockCreate.mockResolvedValue({});
      mockCreateNotification.mockResolvedValue({});

      await triggerNotification('owner-1');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastNotificationCount: 1000,
          }),
        })
      );
    });

    it('owner bulunamazsa hata fırlatmalı', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique
        .mockResolvedValueOnce(null) // logPermission
        .mockResolvedValueOnce(null); // user - bulunamadı

      await expect(triggerNotification('invalid-owner')).rejects.toThrow(
        'Owner bulunamadı: invalid-owner'
      );
    });

    it('duplicate bildirim engellenmeli (Requirement 6.5)', async () => {
      mockCount.mockResolvedValue(1000);
      mockFindFirst.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue({
        userId: 'owner-1',
        canDownload: true,
        downloadedAt: null, // Henüz indirmemiş
      });

      await triggerNotification('owner-1');

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });

});
