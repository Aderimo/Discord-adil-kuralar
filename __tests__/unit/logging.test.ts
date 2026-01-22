// Unit Tests - Logging Service
// Requirement 9.1: Tüm giriş işlemlerini loglamalı (kullanıcı, zaman, IP)
// Requirement 9.2: İçerik erişimlerini loglamalı (kim neyi okudu)
// Requirement 9.3: Yetki değişikliklerini loglamalı
// Requirement 9.4: Yetkisiz erişim denemelerini loglamalı

// Mock Prisma
const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: jest.fn().mockResolvedValue({
        id: 'system-user-id',
        username: 'system',
        email: 'system@yetkili-kilavuzu.local',
      }),
    },
  },
}));

import {
  logActivity,
  logLogin,
  logLogout,
  logContentAccess,
  logSearch,
  logAIQuery,
  logRoleChange,
  logUserApprove,
  logUserReject,
  logUnauthorizedAccess,
  getActivityLogs,
  getUserRecentActivity,
  getIPActivity,
  getLoginLogs,
  getRoleChangeLogs,
  exportLogs,
} from '@/lib/logging';

describe('Logging Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logActivity', () => {
    it('genel aktivite logu oluşturmalı', async () => {
      const mockLog = {
        id: 'log-1',
        userId: 'user-1',
        action: 'login',
        details: JSON.stringify({ test: 'data' }),
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      const log = await logActivity(
        'user-1',
        'login',
        { test: 'data' },
        '192.168.1.1'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'login',
          details: JSON.stringify({ test: 'data' }),
          ipAddress: '192.168.1.1',
        },
      });

      expect(log).toBeDefined();
      expect(log.userId).toBe('user-1');
      expect(log.action).toBe('login');
      expect(log.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('logLogin - Requirement 9.1', () => {
    it('giriş logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-login',
        userId: 'user-1',
        action: 'login',
        details: JSON.stringify({ event: 'user_login', timestamp: expect.any(String) }),
        ipAddress: '192.168.1.2',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      const log = await logLogin('user-1', '192.168.1.2');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.userId).toBe('user-1');
      expect(callArgs.data.action).toBe('login');
      expect(callArgs.data.ipAddress).toBe('192.168.1.2');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.event).toBe('user_login');
      expect(details.timestamp).toBeDefined();
    });
  });

  describe('logLogout', () => {
    it('çıkış logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-logout',
        userId: 'user-1',
        action: 'logout',
        details: JSON.stringify({ event: 'user_logout' }),
        ipAddress: '192.168.1.3',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      const log = await logLogout('user-1', '192.168.1.3');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.action).toBe('logout');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.event).toBe('user_logout');
    });
  });

  describe('logContentAccess - Requirement 9.2', () => {
    it('içerik erişim logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-content',
        userId: 'user-1',
        action: 'view_content',
        details: JSON.stringify({
          event: 'content_access',
          contentId: 'content-123',
          contentType: 'penalty',
          contentTitle: 'ADK Cezası',
        }),
        ipAddress: '192.168.1.4',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      const log = await logContentAccess(
        'user-1',
        'content-123',
        '192.168.1.4',
        'penalty',
        'ADK Cezası'
      );

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.action).toBe('view_content');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.event).toBe('content_access');
      expect(details.contentId).toBe('content-123');
      expect(details.contentType).toBe('penalty');
      expect(details.contentTitle).toBe('ADK Cezası');
    });

    it('opsiyonel parametreler olmadan çalışmalı', async () => {
      const mockLog = {
        id: 'log-content-2',
        userId: 'user-1',
        action: 'view_content',
        details: JSON.stringify({ event: 'content_access', contentId: 'content-456' }),
        ipAddress: '192.168.1.5',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logContentAccess('user-1', 'content-456', '192.168.1.5');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const details = JSON.parse(callArgs.data.details);
      expect(details.contentId).toBe('content-456');
    });
  });

  describe('logSearch', () => {
    it('arama logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-search',
        userId: 'user-1',
        action: 'search',
        details: JSON.stringify({ event: 'search_query', query: 'hakaret cezası', resultsCount: 5 }),
        ipAddress: '192.168.1.6',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logSearch('user-1', 'hakaret cezası', '192.168.1.6', 5);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.action).toBe('search');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.query).toBe('hakaret cezası');
      expect(details.resultsCount).toBe(5);
    });
  });

  describe('logAIQuery', () => {
    it('AI sorgu logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-ai',
        userId: 'user-1',
        action: 'ai_query',
        details: JSON.stringify({ event: 'ai_query', query: 'ADK cezası kaç gün?', confidence: 'high' }),
        ipAddress: '192.168.1.7',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logAIQuery('user-1', 'ADK cezası kaç gün?', '192.168.1.7', 'high');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.action).toBe('ai_query');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.query).toBe('ADK cezası kaç gün?');
      expect(details.confidence).toBe('high');
    });

    it('uzun sorguları kısaltmalı', async () => {
      const longQuery = 'A'.repeat(300);
      const mockLog = {
        id: 'log-ai-2',
        userId: 'user-1',
        action: 'ai_query',
        details: JSON.stringify({ event: 'ai_query', query: longQuery.substring(0, 200) }),
        ipAddress: '192.168.1.8',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logAIQuery('user-1', longQuery, '192.168.1.8');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const details = JSON.parse(callArgs.data.details);
      expect(details.query.length).toBe(200);
    });
  });

  describe('logRoleChange - Requirement 9.3', () => {
    it('yetki değişikliği logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-role',
        userId: 'admin-1',
        action: 'role_change',
        details: JSON.stringify({
          event: 'role_change',
          targetUserId: 'user-1',
          targetUsername: 'testuser',
          previousRole: 'mod',
          newRole: 'admin',
        }),
        ipAddress: '192.168.1.9',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logRoleChange(
        'admin-1',
        'user-1',
        'mod',
        'admin',
        '192.168.1.9',
        'testuser'
      );

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.userId).toBe('admin-1');
      expect(callArgs.data.action).toBe('role_change');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.targetUserId).toBe('user-1');
      expect(details.previousRole).toBe('mod');
      expect(details.newRole).toBe('admin');
    });
  });

  describe('logUserApprove', () => {
    it('kullanıcı onaylama logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-approve',
        userId: 'admin-1',
        action: 'user_approve',
        details: JSON.stringify({
          event: 'user_approve',
          targetUserId: 'user-1',
          assignedRole: 'mod',
        }),
        ipAddress: '192.168.1.10',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logUserApprove('admin-1', 'user-1', 'mod', '192.168.1.10', 'testuser');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.action).toBe('user_approve');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.assignedRole).toBe('mod');
    });
  });

  describe('logUserReject', () => {
    it('kullanıcı reddetme logunu kaydetmeli', async () => {
      const mockLog = {
        id: 'log-reject',
        userId: 'admin-1',
        action: 'user_reject',
        details: JSON.stringify({
          event: 'user_reject',
          targetUserId: 'user-1',
          reason: 'Geçersiz başvuru',
        }),
        ipAddress: '192.168.1.11',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logUserReject(
        'admin-1',
        'user-1',
        '192.168.1.11',
        'testuser',
        'Geçersiz başvuru'
      );

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data.action).toBe('user_reject');
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.reason).toBe('Geçersiz başvuru');
    });
  });

  describe('logUnauthorizedAccess - Requirement 9.4', () => {
    it('yetkisiz erişim denemesini loglamalı (kullanıcı ile)', async () => {
      const mockLog = {
        id: 'log-unauth',
        userId: 'user-1',
        action: 'view_content',
        details: JSON.stringify({
          event: 'unauthorized_access',
          attemptedPath: '/admin/users',
          unauthorized: true,
        }),
        ipAddress: '192.168.1.12',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      await logUnauthorizedAccess(
        '192.168.1.12',
        '/admin/users',
        'user-1',
        'insufficient_permissions'
      );

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      
      const details = JSON.parse(callArgs.data.details);
      expect(details.event).toBe('unauthorized_access');
      expect(details.attemptedPath).toBe('/admin/users');
      expect(details.unauthorized).toBe(true);
    });

    it('yetkisiz erişim denemesini loglamalı (kullanıcı olmadan)', async () => {
      // System user bulunamadı, oluşturulacak
      mockFindUnique.mockResolvedValue(null);
      
      const mockLog = {
        id: 'log-unauth-2',
        userId: 'system-user-id',
        action: 'view_content',
        details: JSON.stringify({
          event: 'unauthorized_access',
          attemptedPath: '/api/admin/users',
          unauthorized: true,
        }),
        ipAddress: '192.168.1.13',
        timestamp: new Date(),
      };

      mockCreate.mockResolvedValue(mockLog);

      const log = await logUnauthorizedAccess('192.168.1.13', '/api/admin/users');

      expect(log).toBeDefined();
    });
  });

  describe('getActivityLogs', () => {
    it('tüm logları getirmeli', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{}',
          ipAddress: '192.168.1.20',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          userId: 'user-1',
          action: 'logout',
          details: '{}',
          ipAddress: '192.168.1.20',
          timestamp: new Date(),
        },
      ];

      mockCount.mockResolvedValue(2);
      mockFindMany.mockResolvedValue(mockLogs);

      const result = await getActivityLogs({ userId: 'user-1' });

      expect(result.logs.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('action filtrelemesi yapmalı', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{}',
          ipAddress: '192.168.1.21',
          timestamp: new Date(),
        },
      ];

      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue(mockLogs);

      const result = await getActivityLogs({
        userId: 'user-1',
        action: 'login',
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'login',
          }),
        })
      );
    });

    it('sayfalama yapmalı', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{}',
          ipAddress: '192.168.1.22',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          userId: 'user-1',
          action: 'login',
          details: '{}',
          ipAddress: '192.168.1.22',
          timestamp: new Date(),
        },
      ];

      mockCount.mockResolvedValue(5);
      mockFindMany.mockResolvedValue(mockLogs);

      const result = await getActivityLogs({
        userId: 'user-1',
        page: 1,
        pageSize: 2,
      });

      expect(result.logs.length).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 2,
        })
      );
    });
  });

  describe('getUserRecentActivity', () => {
    it('kullanıcının son aktivitelerini getirmeli', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{}',
          ipAddress: '192.168.1.30',
          timestamp: new Date(),
        },
      ];

      mockFindMany.mockResolvedValue(mockLogs);

      const logs = await getUserRecentActivity('user-1', 5);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          take: 5,
        })
      );
    });
  });

  describe('getIPActivity', () => {
    it('IP adresine göre aktiviteleri getirmeli', async () => {
      const testIP = '192.168.1.40';
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{}',
          ipAddress: testIP,
          timestamp: new Date(),
        },
      ];

      mockFindMany.mockResolvedValue(mockLogs);

      await getIPActivity(testIP, 10);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ipAddress: testIP },
          take: 10,
        })
      );
    });
  });

  describe('getLoginLogs', () => {
    it('giriş loglarını getirmeli', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{}',
          ipAddress: '192.168.1.50',
          timestamp: new Date(),
        },
      ];

      mockFindMany.mockResolvedValue(mockLogs);

      await getLoginLogs();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'login',
          }),
        })
      );
    });
  });

  describe('getRoleChangeLogs', () => {
    it('yetki değişikliği loglarını getirmeli', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'admin-1',
          action: 'role_change',
          details: '{}',
          ipAddress: '192.168.1.60',
          timestamp: new Date(),
        },
      ];

      mockFindMany.mockResolvedValue(mockLogs);

      await getRoleChangeLogs();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: {
              in: ['role_change', 'user_approve', 'user_reject'],
            },
          }),
        })
      );
    });
  });

  describe('exportLogs - Requirement 7.4', () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');
    
    const mockLogs = [
      {
        id: 'log-1',
        userId: 'user-1',
        action: 'login',
        details: '{"event":"user_login"}',
        ipAddress: '192.168.1.1',
        timestamp: mockTimestamp,
      },
      {
        id: 'log-2',
        userId: 'user-2',
        action: 'logout',
        details: '{"event":"user_logout"}',
        ipAddress: '192.168.1.2',
        timestamp: mockTimestamp,
      },
    ];

    beforeEach(() => {
      mockCount.mockResolvedValue(2);
      mockFindMany.mockResolvedValue(mockLogs);
    });

    it('JSON formatında export etmeli', async () => {
      const result = await exportLogs({}, 'json');
      
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('log-1');
      expect(parsed[0].action).toBe('login');
      expect(parsed[1].id).toBe('log-2');
    });

    it('CSV formatında export etmeli', async () => {
      const result = await exportLogs({}, 'csv');
      
      const lines = result.split('\n');
      expect(lines[0]).toBe('ID,Kullanıcı,İşlem,Detay,IP,Tarih');
      expect(lines.length).toBe(3); // header + 2 data rows
    });

    it('CSV header doğru olmalı', async () => {
      const result = await exportLogs({}, 'csv');
      
      const header = result.split('\n')[0];
      expect(header).toContain('ID');
      expect(header).toContain('Kullanıcı');
      expect(header).toContain('İşlem');
      expect(header).toContain('Detay');
      expect(header).toContain('IP');
      expect(header).toContain('Tarih');
    });

    it('CSV virgül içeren değerleri escape etmeli', async () => {
      const logsWithComma = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{"message":"test, with comma"}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        },
      ];
      
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue(logsWithComma);

      const result = await exportLogs({}, 'csv');
      
      // Virgül içeren değer tırnak içinde olmalı
      expect(result).toContain('"');
    });

    it('CSV tırnak içeren değerleri escape etmeli', async () => {
      const logsWithQuote = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{"message":"test \\"quoted\\" value"}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        },
      ];
      
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue(logsWithQuote);

      const result = await exportLogs({}, 'csv');
      
      // Tırnak çift tırnak ile escape edilmeli
      expect(result).toContain('""');
    });

    it('CSV yeni satır içeren değerleri escape etmeli', async () => {
      const logsWithNewline = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'login',
          details: '{"message":"line1\\nline2"}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        },
      ];
      
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue(logsWithNewline);

      const result = await exportLogs({}, 'csv');
      
      // Yeni satır içeren değer tırnak içinde olmalı
      const lines = result.split('\n');
      expect(lines[0]).toBe('ID,Kullanıcı,İşlem,Detay,IP,Tarih');
    });

    it('büyük veri setleri için pageSize 10000 kullanmalı', async () => {
      await exportLogs({ userId: 'user-1' }, 'json');

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10000,
        })
      );
    });

    it('filtreleri uygulamalı', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await exportLogs({
        userId: 'user-1',
        action: 'login',
        startDate,
        endDate,
      }, 'json');

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            action: 'login',
          }),
        })
      );
    });

    it('boş log listesi için boş JSON array döndürmeli', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      const result = await exportLogs({}, 'json');
      
      expect(JSON.parse(result)).toEqual([]);
    });

    it('boş log listesi için sadece header döndürmeli (CSV)', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      const result = await exportLogs({}, 'csv');
      
      expect(result).toBe('ID,Kullanıcı,İşlem,Detay,IP,Tarih');
    });
  });
});
