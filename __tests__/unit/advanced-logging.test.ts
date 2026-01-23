// Unit Tests - Advanced Logging Service
// Requirements: 1.1, 1.2, 1.3, 1.4 - Ziyaretçi IP Loglama

// Mock Prisma
const mockCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockUserCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
  },
}));

import {
  // Truncation functions
  truncateText,
  truncateAIText,
  truncateInputText,
  truncateCopyText,
  AI_TEXT_MAX_LENGTH,
  INPUT_TEXT_MAX_LENGTH,
  COPY_TEXT_MAX_LENGTH,
  // IP validation functions
  isValidIPv4,
  isValidIPv6,
  isValidIP,
  normalizeIP,
  getIPType,
  DEFAULT_IP_ADDRESS,
  ANONYMOUS_USER_ID,
  // Visitor access logging
  logVisitorAccess,
  type VisitorInfo,
  // AI interaction logging
  logAIInteraction,
  type AIInteractionLog,
  // Page access logging
  logPageAccess,
  type PageAccessLog,
} from '@/lib/advanced-logging';

describe('Advanced Logging Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Truncation Helper Functions Tests
  // Requirements: 2.4, 5.4, 10.3
  // ============================================================================

  describe('Truncation Helper Functions', () => {
    describe('truncateText', () => {
      it('kısa metni değiştirmemeli', () => {
        const text = 'Kısa metin';
        expect(truncateText(text, 100)).toBe(text);
      });

      it('uzun metni belirtilen uzunluğa kısaltmalı', () => {
        const text = 'A'.repeat(150);
        const result = truncateText(text, 100);
        expect(result.length).toBe(100);
      });

      it('tam sınırda olan metni değiştirmemeli', () => {
        const text = 'A'.repeat(100);
        expect(truncateText(text, 100)).toBe(text);
      });

      it('boş string için boş string döndürmeli', () => {
        expect(truncateText('', 100)).toBe('');
      });

      it('null/undefined için boş string döndürmeli', () => {
        expect(truncateText(null as unknown as string, 100)).toBe('');
        expect(truncateText(undefined as unknown as string, 100)).toBe('');
      });
    });

    describe('truncateAIText - Requirement 2.4', () => {
      it('2000 karaktere kısaltmalı', () => {
        const longText = 'A'.repeat(3000);
        const result = truncateAIText(longText);
        expect(result.length).toBe(AI_TEXT_MAX_LENGTH);
        expect(result.length).toBe(2000);
      });

      it('2000 karakterden kısa metni değiştirmemeli', () => {
        const shortText = 'Kısa AI metni';
        expect(truncateAIText(shortText)).toBe(shortText);
      });
    });

    describe('truncateInputText - Requirement 5.4', () => {
      it('1000 karaktere kısaltmalı', () => {
        const longText = 'B'.repeat(1500);
        const result = truncateInputText(longText);
        expect(result.length).toBe(INPUT_TEXT_MAX_LENGTH);
        expect(result.length).toBe(1000);
      });

      it('1000 karakterden kısa metni değiştirmemeli', () => {
        const shortText = 'Kısa input metni';
        expect(truncateInputText(shortText)).toBe(shortText);
      });
    });

    describe('truncateCopyText - Requirement 10.3', () => {
      it('500 karaktere kısaltmalı', () => {
        const longText = 'C'.repeat(800);
        const result = truncateCopyText(longText);
        expect(result.length).toBe(COPY_TEXT_MAX_LENGTH);
        expect(result.length).toBe(500);
      });

      it('500 karakterden kısa metni değiştirmemeli', () => {
        const shortText = 'Kısa kopyalanan metin';
        expect(truncateCopyText(shortText)).toBe(shortText);
      });
    });
  });

  // ============================================================================
  // IP Validation Tests
  // Requirement 1.4: THE Logging_System SHALL store IP addresses in a consistent format
  // ============================================================================

  describe('IP Validation Functions - Requirement 1.4', () => {
    describe('isValidIPv4', () => {
      it('geçerli IPv4 adreslerini kabul etmeli', () => {
        expect(isValidIPv4('192.168.1.1')).toBe(true);
        expect(isValidIPv4('10.0.0.1')).toBe(true);
        expect(isValidIPv4('172.16.0.1')).toBe(true);
        expect(isValidIPv4('255.255.255.255')).toBe(true);
        expect(isValidIPv4('0.0.0.0')).toBe(true);
        expect(isValidIPv4('127.0.0.1')).toBe(true);
      });

      it('geçersiz IPv4 adreslerini reddetmeli', () => {
        expect(isValidIPv4('256.1.1.1')).toBe(false);
        expect(isValidIPv4('192.168.1')).toBe(false);
        expect(isValidIPv4('192.168.1.1.1')).toBe(false);
        expect(isValidIPv4('192.168.1.a')).toBe(false);
        expect(isValidIPv4('')).toBe(false);
        expect(isValidIPv4('invalid')).toBe(false);
      });

      it('null/undefined için false döndürmeli', () => {
        expect(isValidIPv4(null as unknown as string)).toBe(false);
        expect(isValidIPv4(undefined as unknown as string)).toBe(false);
      });

      it('whitespace ile çevrili IP adreslerini kabul etmeli', () => {
        expect(isValidIPv4('  192.168.1.1  ')).toBe(true);
      });
    });

    describe('isValidIPv6', () => {
      it('geçerli IPv6 adreslerini kabul etmeli', () => {
        expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
        expect(isValidIPv6('2001:db8:85a3::8a2e:370:7334')).toBe(true);
        expect(isValidIPv6('::1')).toBe(true);
        expect(isValidIPv6('::')).toBe(true);
        expect(isValidIPv6('fe80::1')).toBe(true);
      });

      it('geçersiz IPv6 adreslerini reddetmeli', () => {
        expect(isValidIPv6('192.168.1.1')).toBe(false);
        expect(isValidIPv6('invalid')).toBe(false);
        expect(isValidIPv6('')).toBe(false);
      });

      it('null/undefined için false döndürmeli', () => {
        expect(isValidIPv6(null as unknown as string)).toBe(false);
        expect(isValidIPv6(undefined as unknown as string)).toBe(false);
      });
    });

    describe('isValidIP', () => {
      it('geçerli IPv4 ve IPv6 adreslerini kabul etmeli', () => {
        expect(isValidIP('192.168.1.1')).toBe(true);
        expect(isValidIP('::1')).toBe(true);
        expect(isValidIP('2001:db8::1')).toBe(true);
      });

      it('geçersiz IP adreslerini reddetmeli', () => {
        expect(isValidIP('invalid')).toBe(false);
        expect(isValidIP('')).toBe(false);
      });
    });

    describe('normalizeIP', () => {
      it('geçerli IP adreslerini olduğu gibi döndürmeli', () => {
        expect(normalizeIP('192.168.1.1')).toBe('192.168.1.1');
        expect(normalizeIP('::1')).toBe('::1');
      });

      it('geçersiz IP için varsayılan değer döndürmeli', () => {
        expect(normalizeIP('invalid')).toBe(DEFAULT_IP_ADDRESS);
        expect(normalizeIP('')).toBe(DEFAULT_IP_ADDRESS);
        expect(normalizeIP(null as unknown as string)).toBe(DEFAULT_IP_ADDRESS);
      });

      it('whitespace temizlemeli', () => {
        expect(normalizeIP('  192.168.1.1  ')).toBe('192.168.1.1');
      });
    });

    describe('getIPType', () => {
      it('IPv4 için "ipv4" döndürmeli', () => {
        expect(getIPType('192.168.1.1')).toBe('ipv4');
      });

      it('IPv6 için "ipv6" döndürmeli', () => {
        expect(getIPType('::1')).toBe('ipv6');
      });

      it('geçersiz IP için "invalid" döndürmeli', () => {
        expect(getIPType('invalid')).toBe('invalid');
      });
    });
  });

  // ============================================================================
  // logVisitorAccess Tests
  // Requirements: 1.1, 1.2, 1.3, 1.4
  // ============================================================================

  describe('logVisitorAccess - Requirements 1.1, 1.2, 1.3, 1.4', () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');

    beforeEach(() => {
      // System user mock
      mockFindUnique.mockResolvedValue({
        id: 'system-user-id',
        username: 'system',
        email: 'system@yetkili-kilavuzu.local',
      });

      mockUserCreate.mockResolvedValue({
        id: 'new-system-user-id',
        username: 'system',
        email: 'system@yetkili-kilavuzu.local',
      });
    });

    describe('Requirement 1.1: IP adresi kaydı', () => {
      it('ziyaretçinin IP adresini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-1',
          userId: 'user-1',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: 'Mozilla/5.0',
            referrer: null,
            isAnonymous: false,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.100',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.100',
          userId: 'user-1',
          sessionId: 'session-1',
          userAgent: 'Mozilla/5.0',
          referrer: null,
        };

        const log = await logVisitorAccess(visitor);

        expect(mockCreate).toHaveBeenCalled();
        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('192.168.1.100');
        expect(log.ipAddress).toBe('192.168.1.100');
      });
    });

    describe('Requirement 1.2: Anonim ziyaretçi kaydı', () => {
      it('anonim ziyaretçi için "anonymous" identifier ile log oluşturmalı', async () => {
        const mockLog = {
          id: 'log-anon',
          userId: 'system-user-id',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: 'Mozilla/5.0',
            referrer: 'https://google.com',
            isAnonymous: true,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '10.0.0.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '10.0.0.1',
          userId: null, // Anonim kullanıcı
          sessionId: null,
          userAgent: 'Mozilla/5.0',
          referrer: 'https://google.com',
        };

        const log = await logVisitorAccess(visitor);

        expect(mockCreate).toHaveBeenCalled();
        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.isAnonymous).toBe(true);
        expect(callArgs.data.action).toBe('visitor_access');
      });

      it('sistem kullanıcısı yoksa oluşturmalı', async () => {
        mockFindUnique.mockResolvedValue(null); // Sistem kullanıcısı yok

        const mockLog = {
          id: 'log-anon-2',
          userId: 'new-system-user-id',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: 'Chrome',
            referrer: null,
            isAnonymous: true,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '172.16.0.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '172.16.0.1',
          userId: null,
          sessionId: null,
          userAgent: 'Chrome',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        expect(mockUserCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            username: 'system',
            email: 'system@yetkili-kilavuzu.local',
          }),
        });
      });
    });

    describe('Requirement 1.3: Authenticated kullanıcı kaydı', () => {
      it('authenticated kullanıcı için user ID ile log oluşturmalı', async () => {
        const mockLog = {
          id: 'log-auth',
          userId: 'real-user-123',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: 'Firefox',
            referrer: 'https://example.com',
            isAnonymous: false,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.50.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.50.1',
          userId: 'real-user-123',
          sessionId: 'session-abc',
          userAgent: 'Firefox',
          referrer: 'https://example.com',
        };

        const log = await logVisitorAccess(visitor);

        expect(mockCreate).toHaveBeenCalled();
        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(callArgs.data.userId).toBe('real-user-123');
        expect(details.isAnonymous).toBe(false);
        expect(log.userId).toBe('real-user-123');
      });
    });

    describe('Requirement 1.4: IP format validasyonu', () => {
      it('geçerli IPv4 adresini olduğu gibi kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ipv4',
          userId: 'user-1',
          action: 'visitor_access',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.1',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('192.168.1.1');
      });

      it('geçerli IPv6 adresini olduğu gibi kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ipv6',
          userId: 'user-1',
          action: 'visitor_access',
          details: '{}',
          ipAddress: '2001:db8::1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '2001:db8::1',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('2001:db8::1');
      });

      it('geçersiz IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-invalid-ip',
          userId: 'user-1',
          action: 'visitor_access',
          details: '{}',
          ipAddress: DEFAULT_IP_ADDRESS,
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: 'invalid-ip-address',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe(DEFAULT_IP_ADDRESS);
      });

      it('boş IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-empty-ip',
          userId: 'user-1',
          action: 'visitor_access',
          details: '{}',
          ipAddress: DEFAULT_IP_ADDRESS,
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe(DEFAULT_IP_ADDRESS);
      });
    });

    describe('Log detayları', () => {
      it('userAgent bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ua',
          userId: 'user-1',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            referrer: null,
            isAnonymous: false,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.1',
          userId: 'user-1',
          sessionId: null,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      });

      it('referrer bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref',
          userId: 'user-1',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: '',
            referrer: 'https://google.com/search?q=test',
            isAnonymous: false,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.1',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: 'https://google.com/search?q=test',
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.referrer).toBe('https://google.com/search?q=test');
      });

      it('timestamp bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ts',
          userId: 'user-1',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: '',
            referrer: null,
            isAnonymous: false,
            timestamp: new Date().toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.1',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.timestamp).toBeDefined();
        expect(typeof details.timestamp).toBe('string');
      });

      it('event türünü "visitor_access" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-event',
          userId: 'user-1',
          action: 'visitor_access',
          details: JSON.stringify({
            event: 'visitor_access',
            userAgent: '',
            referrer: null,
            isAnonymous: false,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.1',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        await logVisitorAccess(visitor);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.event).toBe('visitor_access');
        expect(callArgs.data.action).toBe('visitor_access');
      });
    });
  });

  // ============================================================================
  // logAIInteraction Tests
  // Requirements: 2.1, 2.2, 2.3, 2.5
  // ============================================================================

  describe('logAIInteraction - Requirements 2.1, 2.2, 2.3, 2.5', () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');

    describe('Requirement 2.1: Soru metni kaydı', () => {
      it('kullanıcının sorusunu kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-1',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Test sorusu nedir?',
            response: 'Test cevabı budur.',
            confidence: 'high',
            responseTime: 150,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Test sorusu nedir?',
          response: 'Test cevabı budur.',
          confidence: 'high',
          responseTime: 150,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.question).toBe('Test sorusu nedir?');
      });
    });

    describe('Requirement 2.2: Cevap metni kaydı', () => {
      it('AI cevabını kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-2',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Soru',
            response: 'Detaylı AI cevabı',
            confidence: 'medium',
            responseTime: 200,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Detaylı AI cevabı',
          confidence: 'medium',
          responseTime: 200,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.response).toBe('Detaylı AI cevabı');
      });
    });

    describe('Requirement 2.3: Soru ve cevap birlikte loglama', () => {
      it('soru ve cevabı tek bir log kaydında birleştirmeli', async () => {
        const mockLog = {
          id: 'log-ai-3',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Birleşik soru',
            response: 'Birleşik cevap',
            confidence: 'high',
            responseTime: 100,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Birleşik soru',
          response: 'Birleşik cevap',
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        // Tek bir create çağrısı olmalı
        expect(mockCreate).toHaveBeenCalledTimes(1);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        // Hem soru hem cevap aynı kayıtta olmalı
        expect(details.question).toBe('Birleşik soru');
        expect(details.response).toBe('Birleşik cevap');
        expect(details.event).toBe('ai_interaction');
      });
    });

    describe('Requirement 2.5: Timestamp, user ID ve session context', () => {
      it('timestamp bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-ts',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Soru',
            response: 'Cevap',
            confidence: 'high',
            responseTime: 100,
            timestamp: new Date().toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Cevap',
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.timestamp).toBeDefined();
        expect(typeof details.timestamp).toBe('string');
        // ISO format kontrolü
        expect(() => new Date(details.timestamp)).not.toThrow();
      });

      it('user ID bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-uid',
          userId: 'specific-user-123',
          action: 'ai_interaction',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Cevap',
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('specific-user-123', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.userId).toBe('specific-user-123');
      });
    });

    describe('Metin truncation', () => {
      it('2000 karakterden uzun soruyu kısaltmalı', async () => {
        const longQuestion = 'Q'.repeat(3000);
        const mockLog = {
          id: 'log-ai-trunc-q',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Q'.repeat(2000),
            response: 'Cevap',
            confidence: 'high',
            responseTime: 100,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: longQuestion,
          response: 'Cevap',
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.question.length).toBe(2000);
      });

      it('2000 karakterden uzun cevabı kısaltmalı', async () => {
        const longResponse = 'R'.repeat(3000);
        const mockLog = {
          id: 'log-ai-trunc-r',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Soru',
            response: 'R'.repeat(2000),
            confidence: 'high',
            responseTime: 100,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: longResponse,
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.response.length).toBe(2000);
      });

      it('kısa metinleri değiştirmemeli', async () => {
        const shortQuestion = 'Kısa soru';
        const shortResponse = 'Kısa cevap';
        const mockLog = {
          id: 'log-ai-short',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: shortQuestion,
            response: shortResponse,
            confidence: 'high',
            responseTime: 100,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: shortQuestion,
          response: shortResponse,
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.question).toBe(shortQuestion);
        expect(details.response).toBe(shortResponse);
      });
    });

    describe('IP adresi işleme', () => {
      it('geçerli IP adresini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-ip',
          userId: 'user-1',
          action: 'ai_interaction',
          details: '{}',
          ipAddress: '10.0.0.50',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Cevap',
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, '10.0.0.50');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('10.0.0.50');
      });

      it('geçersiz IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-ai-invalid-ip',
          userId: 'user-1',
          action: 'ai_interaction',
          details: '{}',
          ipAddress: DEFAULT_IP_ADDRESS,
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Cevap',
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, 'invalid-ip');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe(DEFAULT_IP_ADDRESS);
      });
    });

    describe('Confidence ve responseTime', () => {
      it('confidence değerini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-conf',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Soru',
            response: 'Cevap',
            confidence: 'low',
            responseTime: 500,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Cevap',
          confidence: 'low',
          responseTime: 500,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.confidence).toBe('low');
      });

      it('responseTime değerini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-rt',
          userId: 'user-1',
          action: 'ai_interaction',
          details: JSON.stringify({
            event: 'ai_interaction',
            question: 'Soru',
            response: 'Cevap',
            confidence: 'high',
            responseTime: 1234,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Cevap',
          confidence: 'high',
          responseTime: 1234,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.responseTime).toBe(1234);
      });
    });

    describe('Action türü', () => {
      it('action türünü "ai_interaction" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ai-action',
          userId: 'user-1',
          action: 'ai_interaction',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const interaction: AIInteractionLog = {
          question: 'Soru',
          response: 'Cevap',
          confidence: 'high',
          responseTime: 100,
        };

        await logAIInteraction('user-1', interaction, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.action).toBe('ai_interaction');
      });
    });
  });

  // ============================================================================
  // logPageAccess Tests
  // Requirements: 3.1, 3.2, 3.3, 3.4
  // ============================================================================

  describe('logPageAccess - Requirements 3.1, 3.2, 3.3, 3.4', () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');

    describe('Requirement 3.1: Sayfa URL kaydı', () => {
      it('ziyaret edilen sayfanın URL\'sini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-1',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/guide/trafik-cezalari',
            title: 'Trafik Cezaları',
            category: 'guide',
            contentType: 'article',
            referrerUrl: null,
            accessType: 'direct',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/guide/trafik-cezalari',
          title: 'Trafik Cezaları',
          category: 'guide',
          contentType: 'article',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.url).toBe('/guide/trafik-cezalari');
      });

      it('farklı URL formatlarını doğru kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-url',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/penalties/category/hiz-ihlali?page=2',
            title: 'Hız İhlali',
            category: 'penalties',
            contentType: 'list',
            referrerUrl: null,
            accessType: 'navigation',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/penalties/category/hiz-ihlali?page=2',
          title: 'Hız İhlali',
          category: 'penalties',
          contentType: 'list',
          referrerUrl: null,
          accessType: 'navigation',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.url).toBe('/penalties/category/hiz-ihlali?page=2');
      });
    });

    describe('Requirement 3.2: Sayfa başlığı, kategori ve içerik türü', () => {
      it('sayfa başlığını kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-title',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/procedures/ehliyet-yenileme',
            title: 'Ehliyet Yenileme Prosedürü',
            category: 'procedures',
            contentType: 'procedure',
            referrerUrl: null,
            accessType: 'direct',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/procedures/ehliyet-yenileme',
          title: 'Ehliyet Yenileme Prosedürü',
          category: 'procedures',
          contentType: 'procedure',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.title).toBe('Ehliyet Yenileme Prosedürü');
      });

      it('kategori bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-cat',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/commands/trafik',
            title: 'Trafik Komutları',
            category: 'commands',
            contentType: 'list',
            referrerUrl: null,
            accessType: 'navigation',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/commands/trafik',
          title: 'Trafik Komutları',
          category: 'commands',
          contentType: 'list',
          referrerUrl: null,
          accessType: 'navigation',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.category).toBe('commands');
      });

      it('içerik türünü kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-content',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/admin/logs',
            title: 'Log Yönetimi',
            category: 'admin',
            contentType: 'dashboard',
            referrerUrl: null,
            accessType: 'navigation',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/admin/logs',
          title: 'Log Yönetimi',
          category: 'admin',
          contentType: 'dashboard',
          referrerUrl: null,
          accessType: 'navigation',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.contentType).toBe('dashboard');
      });
    });

    describe('Requirement 3.3: Referrer URL kaydı', () => {
      it('referrer URL varsa kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-ref',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/guide/trafik-cezalari',
            title: 'Trafik Cezaları',
            category: 'guide',
            contentType: 'article',
            referrerUrl: 'https://google.com/search?q=trafik+cezalari',
            accessType: 'external',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/guide/trafik-cezalari',
          title: 'Trafik Cezaları',
          category: 'guide',
          contentType: 'article',
          referrerUrl: 'https://google.com/search?q=trafik+cezalari',
          accessType: 'external',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.referrerUrl).toBe('https://google.com/search?q=trafik+cezalari');
      });

      it('referrer URL yoksa null olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-no-ref',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/guide',
            title: 'Kılavuz',
            category: 'guide',
            contentType: 'index',
            referrerUrl: null,
            accessType: 'direct',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/guide',
          title: 'Kılavuz',
          category: 'guide',
          contentType: 'index',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.referrerUrl).toBeNull();
      });

      it('site içi referrer URL\'sini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-internal-ref',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/penalties/hiz-ihlali',
            title: 'Hız İhlali Cezası',
            category: 'penalties',
            contentType: 'detail',
            referrerUrl: '/penalties',
            accessType: 'navigation',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/penalties/hiz-ihlali',
          title: 'Hız İhlali Cezası',
          category: 'penalties',
          contentType: 'detail',
          referrerUrl: '/penalties',
          accessType: 'navigation',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.referrerUrl).toBe('/penalties');
      });
    });

    describe('Requirement 3.4: Erişim türü ayrımı', () => {
      it('direct erişim türünü kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-direct',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/',
            title: 'Ana Sayfa',
            category: 'home',
            contentType: 'page',
            referrerUrl: null,
            accessType: 'direct',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/',
          title: 'Ana Sayfa',
          category: 'home',
          contentType: 'page',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.accessType).toBe('direct');
      });

      it('navigation erişim türünü kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-nav',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/guide/detay',
            title: 'Detay Sayfası',
            category: 'guide',
            contentType: 'article',
            referrerUrl: '/guide',
            accessType: 'navigation',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/guide/detay',
          title: 'Detay Sayfası',
          category: 'guide',
          contentType: 'article',
          referrerUrl: '/guide',
          accessType: 'navigation',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.accessType).toBe('navigation');
      });

      it('external erişim türünü kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-ext',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/guide/onemli-bilgi',
            title: 'Önemli Bilgi',
            category: 'guide',
            contentType: 'article',
            referrerUrl: 'https://twitter.com/share',
            accessType: 'external',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/guide/onemli-bilgi',
          title: 'Önemli Bilgi',
          category: 'guide',
          contentType: 'article',
          referrerUrl: 'https://twitter.com/share',
          accessType: 'external',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.accessType).toBe('external');
      });
    });

    describe('IP adresi işleme', () => {
      it('geçerli IP adresini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-ip',
          userId: 'user-1',
          action: 'page_access',
          details: '{}',
          ipAddress: '10.0.0.100',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/test',
          title: 'Test',
          category: 'test',
          contentType: 'page',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '10.0.0.100');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('10.0.0.100');
      });

      it('geçersiz IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-page-invalid-ip',
          userId: 'user-1',
          action: 'page_access',
          details: '{}',
          ipAddress: DEFAULT_IP_ADDRESS,
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/test',
          title: 'Test',
          category: 'test',
          contentType: 'page',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, 'invalid-ip');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe(DEFAULT_IP_ADDRESS);
      });
    });

    describe('Timestamp ve action türü', () => {
      it('timestamp bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-ts',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/test',
            title: 'Test',
            category: 'test',
            contentType: 'page',
            referrerUrl: null,
            accessType: 'direct',
            timestamp: new Date().toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/test',
          title: 'Test',
          category: 'test',
          contentType: 'page',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.timestamp).toBeDefined();
        expect(typeof details.timestamp).toBe('string');
        // ISO format kontrolü
        expect(() => new Date(details.timestamp)).not.toThrow();
      });

      it('action türünü "page_access" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-action',
          userId: 'user-1',
          action: 'page_access',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/test',
          title: 'Test',
          category: 'test',
          contentType: 'page',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.action).toBe('page_access');
      });

      it('event türünü "page_access" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-event',
          userId: 'user-1',
          action: 'page_access',
          details: JSON.stringify({
            event: 'page_access',
            url: '/test',
            title: 'Test',
            category: 'test',
            contentType: 'page',
            referrerUrl: null,
            accessType: 'direct',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/test',
          title: 'Test',
          category: 'test',
          contentType: 'page',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('user-1', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.event).toBe('page_access');
      });
    });

    describe('User ID kaydı', () => {
      it('user ID bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-page-uid',
          userId: 'specific-user-456',
          action: 'page_access',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const access: PageAccessLog = {
          url: '/test',
          title: 'Test',
          category: 'test',
          contentType: 'page',
          referrerUrl: null,
          accessType: 'direct',
        };

        await logPageAccess('specific-user-456', access, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.userId).toBe('specific-user-456');
      });
    });
  });
});
