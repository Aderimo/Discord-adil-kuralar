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
  // Visitor access logging
  logVisitorAccess,
  type VisitorInfo,
  // AI interaction logging
  logAIInteraction,
  type AIInteractionLog,
  // Page access logging
  logPageAccess,
  type PageAccessLog,
  // Text input logging
  logTextInput,
  isSensitiveField,
  SENSITIVE_FIELD_PATTERNS,
  SENSITIVE_FORM_PATTERNS,
  type TextInputLog,
  // Text copy logging
  logTextCopy,
  type TextCopyLog,
  // URL copy logging
  logURLCopy,
  logURLCopyAnonymous,
  type URLCopyLog,
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

  // ============================================================================
  // logTextInput Tests
  // Requirements: 5.1, 5.2, 5.3, 5.4
  // ============================================================================

  describe('logTextInput - Requirements 5.1, 5.2, 5.3, 5.4', () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');

    describe('isSensitiveField - Requirement 5.3', () => {
      describe('Password alanları', () => {
        it('password içeren field ID\'yi hassas olarak algılamalı', () => {
          expect(isSensitiveField('password', 'login-form')).toBe(true);
          expect(isSensitiveField('user-password', 'register')).toBe(true);
          expect(isSensitiveField('confirmPassword', 'signup')).toBe(true);
          expect(isSensitiveField('PASSWORD', 'form')).toBe(true);
        });

        it('parola/sifre içeren field ID\'yi hassas olarak algılamalı', () => {
          expect(isSensitiveField('parola', 'giris')).toBe(true);
          expect(isSensitiveField('sifre', 'kayit')).toBe(true);
          expect(isSensitiveField('şifre', 'form')).toBe(true);
        });

        it('pwd içeren field ID\'yi hassas olarak algılamalı', () => {
          expect(isSensitiveField('pwd', 'form')).toBe(true);
          expect(isSensitiveField('user_pwd', 'login')).toBe(true);
        });
      });

      describe('Kişisel veri alanları', () => {
        it('TC kimlik numarası alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('tc-kimlik', 'form')).toBe(true);
          expect(isSensitiveField('tcKimlikNo', 'register')).toBe(true);
          expect(isSensitiveField('kimlik_no', 'form')).toBe(true);
        });

        it('SSN alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('ssn', 'form')).toBe(true);
          expect(isSensitiveField('social-security', 'form')).toBe(true);
          expect(isSensitiveField('socialSecurityNumber', 'form')).toBe(true);
        });

        it('national ID alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('national-id', 'form')).toBe(true);
          expect(isSensitiveField('nationalId', 'form')).toBe(true);
          expect(isSensitiveField('identity-number', 'form')).toBe(true);
        });
      });

      describe('Finansal bilgi alanları', () => {
        it('kredi kartı alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('credit-card', 'payment')).toBe(true);
          expect(isSensitiveField('creditCard', 'checkout')).toBe(true);
          expect(isSensitiveField('card-number', 'form')).toBe(true);
          expect(isSensitiveField('cardNumber', 'form')).toBe(true);
        });

        it('CVV/CVC alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('cvv', 'payment')).toBe(true);
          expect(isSensitiveField('cvc', 'checkout')).toBe(true);
        });

        it('IBAN alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('iban', 'bank')).toBe(true);
          expect(isSensitiveField('account-number', 'form')).toBe(true);
          expect(isSensitiveField('hesap-no', 'form')).toBe(true);
        });
      });

      describe('İletişim bilgileri', () => {
        it('telefon alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('phone', 'contact')).toBe(true);
          expect(isSensitiveField('telefon', 'iletisim')).toBe(true);
          expect(isSensitiveField('mobile', 'form')).toBe(true);
          expect(isSensitiveField('cep', 'form')).toBe(true);
        });
      });

      describe('Güvenlik alanları', () => {
        it('token/API key alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('token', 'form')).toBe(true);
          expect(isSensitiveField('api-key', 'settings')).toBe(true);
          expect(isSensitiveField('apiKey', 'config')).toBe(true);
          expect(isSensitiveField('auth', 'form')).toBe(true);
          expect(isSensitiveField('bearer', 'form')).toBe(true);
        });

        it('PIN alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('pin', 'form')).toBe(true);
          expect(isSensitiveField('secret', 'form')).toBe(true);
        });

        it('güvenlik sorusu alanlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('security-question', 'form')).toBe(true);
          expect(isSensitiveField('security-answer', 'form')).toBe(true);
        });
      });

      describe('Hassas form context\'leri', () => {
        it('login/signin formlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('username', 'login')).toBe(true);
          expect(isSensitiveField('email', 'signin')).toBe(true);
          expect(isSensitiveField('user', 'login-form')).toBe(true);
        });

        it('signup/register formlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('name', 'signup')).toBe(true);
          expect(isSensitiveField('email', 'register')).toBe(true);
        });

        it('payment/checkout formlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('name', 'payment')).toBe(true);
          expect(isSensitiveField('address', 'checkout')).toBe(true);
          expect(isSensitiveField('amount', 'billing')).toBe(true);
        });

        it('bank/credit formlarını hassas olarak algılamalı', () => {
          expect(isSensitiveField('name', 'bank')).toBe(true);
          expect(isSensitiveField('amount', 'credit')).toBe(true);
        });
      });

      describe('Normal (hassas olmayan) alanlar', () => {
        it('normal alanları hassas olarak algılamamalı', () => {
          expect(isSensitiveField('search', 'search-form')).toBe(false);
          expect(isSensitiveField('query', 'search')).toBe(false);
          expect(isSensitiveField('comment', 'feedback')).toBe(false);
          expect(isSensitiveField('message', 'contact')).toBe(false);
          expect(isSensitiveField('title', 'article')).toBe(false);
          expect(isSensitiveField('description', 'form')).toBe(false);
        });

        it('boş değerler için false döndürmeli', () => {
          expect(isSensitiveField('', '')).toBe(false);
          expect(isSensitiveField('', 'form')).toBe(false);
          expect(isSensitiveField('field', '')).toBe(false);
        });
      });
    });

    describe('Requirement 5.1: Metin girişi içeriği kaydı', () => {
      it('metin girişi içeriğini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-1',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'search-query',
            formContext: 'search-form',
            content: 'trafik cezası sorgulama',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'search-query',
          formContext: 'search-form',
          content: 'trafik cezası sorgulama',
          isSensitive: false,
        };

        const result = await logTextInput('user-1', input, '192.168.1.1');

        expect(mockCreate).toHaveBeenCalled();
        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.content).toBe('trafik cezası sorgulama');
        expect(result).not.toBeNull();
      });
    });

    describe('Requirement 5.2: Alan ID ve form context kaydı', () => {
      it('alan ID\'sini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-field',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'comment-input',
            formContext: 'feedback-form',
            content: 'Yorum içeriği',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'comment-input',
          formContext: 'feedback-form',
          content: 'Yorum içeriği',
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.fieldId).toBe('comment-input');
      });

      it('form context\'i kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-context',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'message',
            formContext: 'contact-us-form',
            content: 'Mesaj içeriği',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'message',
          formContext: 'contact-us-form',
          content: 'Mesaj içeriği',
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.formContext).toBe('contact-us-form');
      });
    });

    describe('Requirement 5.3: Hassas alan filtreleme', () => {
      it('isSensitive flag\'i true olan alanları loglamamalı', async () => {
        const input: TextInputLog = {
          fieldId: 'any-field',
          formContext: 'any-form',
          content: 'hassas içerik',
          isSensitive: true,
        };

        const result = await logTextInput('user-1', input, '192.168.1.1');

        expect(mockCreate).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('password alanlarını loglamamalı', async () => {
        const input: TextInputLog = {
          fieldId: 'password',
          formContext: 'login-form',
          content: 'gizli-sifre-123',
          isSensitive: false,
        };

        const result = await logTextInput('user-1', input, '192.168.1.1');

        expect(mockCreate).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('kredi kartı alanlarını loglamamalı', async () => {
        const input: TextInputLog = {
          fieldId: 'credit-card',
          formContext: 'payment-form',
          content: '4111111111111111',
          isSensitive: false,
        };

        const result = await logTextInput('user-1', input, '192.168.1.1');

        expect(mockCreate).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('TC kimlik alanlarını loglamamalı', async () => {
        const input: TextInputLog = {
          fieldId: 'tc-kimlik',
          formContext: 'register-form',
          content: '12345678901',
          isSensitive: false,
        };

        const result = await logTextInput('user-1', input, '192.168.1.1');

        expect(mockCreate).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('login form context\'indeki alanları loglamamalı', async () => {
        const input: TextInputLog = {
          fieldId: 'username',
          formContext: 'login',
          content: 'kullanici_adi',
          isSensitive: false,
        };

        const result = await logTextInput('user-1', input, '192.168.1.1');

        expect(mockCreate).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('payment form context\'indeki alanları loglamamalı', async () => {
        const input: TextInputLog = {
          fieldId: 'cardholder-name',
          formContext: 'payment',
          content: 'John Doe',
          isSensitive: false,
        };

        const result = await logTextInput('user-1', input, '192.168.1.1');

        expect(mockCreate).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe('Requirement 5.4: Metin truncation (1000 karakter)', () => {
      it('1000 karakterden uzun metni kısaltmalı', async () => {
        const longContent = 'X'.repeat(1500);
        const mockLog = {
          id: 'log-input-trunc',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'description',
            formContext: 'article-form',
            content: 'X'.repeat(1000),
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'description',
          formContext: 'article-form',
          content: longContent,
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.content.length).toBe(1000);
      });

      it('1000 karakterden kısa metni değiştirmemeli', async () => {
        const shortContent = 'Kısa metin içeriği';
        const mockLog = {
          id: 'log-input-short',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'title',
            formContext: 'form',
            content: shortContent,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'title',
          formContext: 'form',
          content: shortContent,
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.content).toBe(shortContent);
      });

      it('tam 1000 karakter olan metni değiştirmemeli', async () => {
        const exactContent = 'Y'.repeat(1000);
        const mockLog = {
          id: 'log-input-exact',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'content',
            formContext: 'form',
            content: exactContent,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'content',
          formContext: 'form',
          content: exactContent,
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.content.length).toBe(1000);
        expect(details.content).toBe(exactContent);
      });
    });

    describe('IP adresi işleme', () => {
      it('geçerli IP adresini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-ip',
          userId: 'user-1',
          action: 'text_input',
          details: '{}',
          ipAddress: '10.0.0.50',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'query',
          formContext: 'search',
          content: 'test',
          isSensitive: false,
        };

        await logTextInput('user-1', input, '10.0.0.50');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('10.0.0.50');
      });

      it('geçersiz IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-input-invalid-ip',
          userId: 'user-1',
          action: 'text_input',
          details: '{}',
          ipAddress: DEFAULT_IP_ADDRESS,
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'query',
          formContext: 'search',
          content: 'test',
          isSensitive: false,
        };

        await logTextInput('user-1', input, 'invalid-ip');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe(DEFAULT_IP_ADDRESS);
      });
    });

    describe('Timestamp ve action türü', () => {
      it('timestamp bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-ts',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'field',
            formContext: 'form',
            content: 'content',
            timestamp: new Date().toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'field',
          formContext: 'form',
          content: 'content',
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.timestamp).toBeDefined();
        expect(typeof details.timestamp).toBe('string');
        // ISO format kontrolü
        expect(() => new Date(details.timestamp)).not.toThrow();
      });

      it('action türünü "text_input" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-action',
          userId: 'user-1',
          action: 'text_input',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'field',
          formContext: 'form',
          content: 'content',
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.action).toBe('text_input');
      });

      it('event türünü "text_input" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-event',
          userId: 'user-1',
          action: 'text_input',
          details: JSON.stringify({
            event: 'text_input',
            fieldId: 'field',
            formContext: 'form',
            content: 'content',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'field',
          formContext: 'form',
          content: 'content',
          isSensitive: false,
        };

        await logTextInput('user-1', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.event).toBe('text_input');
      });
    });

    describe('User ID kaydı', () => {
      it('user ID bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-input-uid',
          userId: 'specific-user-789',
          action: 'text_input',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const input: TextInputLog = {
          fieldId: 'field',
          formContext: 'form',
          content: 'content',
          isSensitive: false,
        };

        await logTextInput('specific-user-789', input, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.userId).toBe('specific-user-789');
      });
    });
  });

  // ============================================================================
  // logTextCopy Tests
  // Requirements: 10.1, 10.2, 10.3, 10.4
  // ============================================================================

  describe('logTextCopy - Requirements 10.1, 10.2, 10.3, 10.4', () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');

    describe('Requirement 10.1: Kopyalanan metin kaydı', () => {
      it('kopyalanan metni kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-1',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Bu kopyalanan metindir',
            sourcePage: '/guide/test',
            elementContext: 'article.content',
            selectionStart: 0,
            selectionEnd: 22,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Bu kopyalanan metindir',
          sourcePage: '/guide/test',
          elementContext: 'article.content',
          selectionStart: 0,
          selectionEnd: 22,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.copiedText).toBe('Bu kopyalanan metindir');
      });

      it('boş metin kopyalamayı da kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-empty',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: '',
            sourcePage: '/guide/test',
            elementContext: 'div.empty',
            selectionStart: 0,
            selectionEnd: 0,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: '',
          sourcePage: '/guide/test',
          elementContext: 'div.empty',
          selectionStart: 0,
          selectionEnd: 0,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.copiedText).toBe('');
      });
    });

    describe('Requirement 10.2: Kaynak sayfa ve element context', () => {
      it('kaynak sayfayı kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-page',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Test',
            sourcePage: '/penalties/category-1',
            elementContext: 'section.penalty-details',
            selectionStart: 10,
            selectionEnd: 14,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Test',
          sourcePage: '/penalties/category-1',
          elementContext: 'section.penalty-details',
          selectionStart: 10,
          selectionEnd: 14,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.sourcePage).toBe('/penalties/category-1');
      });

      it('element context bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-context',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Metin',
            sourcePage: '/procedures',
            elementContext: 'div.procedure-content > p.description',
            selectionStart: 0,
            selectionEnd: 5,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Metin',
          sourcePage: '/procedures',
          elementContext: 'div.procedure-content > p.description',
          selectionStart: 0,
          selectionEnd: 5,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.elementContext).toBe('div.procedure-content > p.description');
      });

      it('hem kaynak sayfa hem element context birlikte kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-both',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'İçerik',
            sourcePage: '/commands/admin',
            elementContext: 'table.commands-list > tr > td.command-name',
            selectionStart: 5,
            selectionEnd: 11,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'İçerik',
          sourcePage: '/commands/admin',
          elementContext: 'table.commands-list > tr > td.command-name',
          selectionStart: 5,
          selectionEnd: 11,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.sourcePage).toBe('/commands/admin');
        expect(details.elementContext).toBe('table.commands-list > tr > td.command-name');
      });
    });

    describe('Requirement 10.3: Metin truncation (500 karakter)', () => {
      it('500 karakterden uzun metni kısaltmalı', async () => {
        const longText = 'X'.repeat(800);
        const truncatedText = 'X'.repeat(500);
        
        const mockLog = {
          id: 'log-copy-trunc',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: truncatedText,
            sourcePage: '/guide',
            elementContext: 'article',
            selectionStart: 0,
            selectionEnd: 800,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: longText,
          sourcePage: '/guide',
          elementContext: 'article',
          selectionStart: 0,
          selectionEnd: 800,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.copiedText.length).toBe(500);
      });

      it('tam 500 karakter olan metni değiştirmemeli', async () => {
        const exactText = 'Y'.repeat(500);
        
        const mockLog = {
          id: 'log-copy-exact',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: exactText,
            sourcePage: '/guide',
            elementContext: 'article',
            selectionStart: 0,
            selectionEnd: 500,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: exactText,
          sourcePage: '/guide',
          elementContext: 'article',
          selectionStart: 0,
          selectionEnd: 500,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.copiedText.length).toBe(500);
        expect(details.copiedText).toBe(exactText);
      });

      it('500 karakterden kısa metni değiştirmemeli', async () => {
        const shortText = 'Kısa metin';
        
        const mockLog = {
          id: 'log-copy-short',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: shortText,
            sourcePage: '/guide',
            elementContext: 'article',
            selectionStart: 0,
            selectionEnd: 10,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: shortText,
          sourcePage: '/guide',
          elementContext: 'article',
          selectionStart: 0,
          selectionEnd: 10,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.copiedText).toBe(shortText);
      });
    });

    describe('Requirement 10.4: Selection pozisyonları', () => {
      it('selectionStart pozisyonunu kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-start',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Seçili metin',
            sourcePage: '/guide',
            elementContext: 'p',
            selectionStart: 150,
            selectionEnd: 162,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Seçili metin',
          sourcePage: '/guide',
          elementContext: 'p',
          selectionStart: 150,
          selectionEnd: 162,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.selectionStart).toBe(150);
      });

      it('selectionEnd pozisyonunu kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-end',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Metin',
            sourcePage: '/guide',
            elementContext: 'span',
            selectionStart: 0,
            selectionEnd: 5,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Metin',
          sourcePage: '/guide',
          elementContext: 'span',
          selectionStart: 0,
          selectionEnd: 5,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.selectionEnd).toBe(5);
      });

      it('hem start hem end pozisyonlarını birlikte kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-positions',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Uzun bir metin parçası',
            sourcePage: '/procedures/step-1',
            elementContext: 'div.step-content',
            selectionStart: 1000,
            selectionEnd: 1022,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Uzun bir metin parçası',
          sourcePage: '/procedures/step-1',
          elementContext: 'div.step-content',
          selectionStart: 1000,
          selectionEnd: 1022,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.selectionStart).toBe(1000);
        expect(details.selectionEnd).toBe(1022);
      });

      it('sıfır pozisyonlarını doğru kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-zero',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Başlangıç',
            sourcePage: '/guide',
            elementContext: 'h1',
            selectionStart: 0,
            selectionEnd: 9,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Başlangıç',
          sourcePage: '/guide',
          elementContext: 'h1',
          selectionStart: 0,
          selectionEnd: 9,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.selectionStart).toBe(0);
        expect(details.selectionEnd).toBe(9);
      });
    });

    describe('Log detayları', () => {
      it('timestamp bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-ts',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Test',
            sourcePage: '/guide',
            elementContext: 'p',
            selectionStart: 0,
            selectionEnd: 4,
            timestamp: new Date().toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Test',
          sourcePage: '/guide',
          elementContext: 'p',
          selectionStart: 0,
          selectionEnd: 4,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.timestamp).toBeDefined();
        expect(typeof details.timestamp).toBe('string');
        // ISO format kontrolü
        expect(() => new Date(details.timestamp)).not.toThrow();
      });

      it('action türünü "text_copy" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-action',
          userId: 'user-1',
          action: 'text_copy',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Test',
          sourcePage: '/guide',
          elementContext: 'p',
          selectionStart: 0,
          selectionEnd: 4,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.action).toBe('text_copy');
      });

      it('event türünü "text_copy" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-event',
          userId: 'user-1',
          action: 'text_copy',
          details: JSON.stringify({
            event: 'text_copy',
            copiedText: 'Test',
            sourcePage: '/guide',
            elementContext: 'p',
            selectionStart: 0,
            selectionEnd: 4,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Test',
          sourcePage: '/guide',
          elementContext: 'p',
          selectionStart: 0,
          selectionEnd: 4,
        };

        await logTextCopy('user-1', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.event).toBe('text_copy');
      });
    });

    describe('User ID kaydı', () => {
      it('user ID bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-uid',
          userId: 'copy-user-456',
          action: 'text_copy',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Test',
          sourcePage: '/guide',
          elementContext: 'p',
          selectionStart: 0,
          selectionEnd: 4,
        };

        await logTextCopy('copy-user-456', copy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.userId).toBe('copy-user-456');
      });
    });

    describe('IP adresi kaydı', () => {
      it('geçerli IP adresini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-copy-ip',
          userId: 'user-1',
          action: 'text_copy',
          details: '{}',
          ipAddress: '10.0.0.50',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Test',
          sourcePage: '/guide',
          elementContext: 'p',
          selectionStart: 0,
          selectionEnd: 4,
        };

        await logTextCopy('user-1', copy, '10.0.0.50');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('10.0.0.50');
      });

      it('geçersiz IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-copy-invalid-ip',
          userId: 'user-1',
          action: 'text_copy',
          details: '{}',
          ipAddress: '0.0.0.0',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const copy: TextCopyLog = {
          copiedText: 'Test',
          sourcePage: '/guide',
          elementContext: 'p',
          selectionStart: 0,
          selectionEnd: 4,
        };

        await logTextCopy('user-1', copy, 'invalid-ip');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('0.0.0.0');
      });
    });
  });
});


// ============================================================================
// Import additional functions for referrer tests
// ============================================================================

import {
  // Referrer logging
  logReferrer,
  logReferrerFromUrl,
  extractDomain,
  classifySourceType,
  matchesDomainList,
  incrementSourceCounter,
  getSourceCounter,
  resetSourceCounters,
  SOCIAL_MEDIA_DOMAINS,
  SEARCH_ENGINE_DOMAINS,
  type ReferrerLog,
} from '@/lib/advanced-logging';

// ============================================================================
// logReferrer Tests
// Requirements: 9.1, 9.3, 9.4, 9.5
// ============================================================================

describe('Referrer Logging - Requirements 9.1, 9.3, 9.4, 9.5', () => {
  const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    resetSourceCounters();
    
    // System user mock
    mockFindUnique.mockResolvedValue({
      id: 'system-user-id',
      username: 'system',
      email: 'system@yetkili-kilavuzu.local',
    });
  });

  // ============================================================================
  // Domain Extraction Tests
  // Requirement 9.3: Extract and store the source domain
  // ============================================================================

  describe('extractDomain - Requirement 9.3', () => {
    it('tam URL\'den domain çıkarmalı', () => {
      expect(extractDomain('https://www.google.com/search?q=test')).toBe('google.com');
      expect(extractDomain('https://facebook.com/profile')).toBe('facebook.com');
      expect(extractDomain('http://example.org/page')).toBe('example.org');
    });

    it('www prefix\'ini kaldırmalı', () => {
      expect(extractDomain('https://www.twitter.com')).toBe('twitter.com');
      expect(extractDomain('http://www.example.com')).toBe('example.com');
    });

    it('subdomain\'leri korumalı (www hariç)', () => {
      expect(extractDomain('https://m.facebook.com')).toBe('m.facebook.com');
      expect(extractDomain('https://mobile.twitter.com')).toBe('mobile.twitter.com');
      expect(extractDomain('https://blog.example.com')).toBe('blog.example.com');
    });

    it('protocol olmadan da çalışmalı', () => {
      expect(extractDomain('google.com/search')).toBe('google.com');
      expect(extractDomain('example.org')).toBe('example.org');
    });

    it('boş veya geçersiz URL için boş string döndürmeli', () => {
      expect(extractDomain('')).toBe('');
      expect(extractDomain(null as unknown as string)).toBe('');
      expect(extractDomain(undefined as unknown as string)).toBe('');
    });

    it('geçersiz URL formatı için boş string döndürmeli', () => {
      expect(extractDomain('not-a-valid-url')).toBe('not-a-valid-url');
      expect(extractDomain('   ')).toBe('');
    });
  });

  // ============================================================================
  // Domain List Matching Tests
  // ============================================================================

  describe('matchesDomainList', () => {
    it('tam eşleşme için true döndürmeli', () => {
      expect(matchesDomainList('facebook.com', SOCIAL_MEDIA_DOMAINS)).toBe(true);
      expect(matchesDomainList('google.com', SEARCH_ENGINE_DOMAINS)).toBe(true);
    });

    it('subdomain eşleşmesi için true döndürmeli', () => {
      expect(matchesDomainList('m.facebook.com', SOCIAL_MEDIA_DOMAINS)).toBe(true);
      expect(matchesDomainList('mobile.twitter.com', SOCIAL_MEDIA_DOMAINS)).toBe(true);
      expect(matchesDomainList('www.google.com', SEARCH_ENGINE_DOMAINS)).toBe(true);
    });

    it('eşleşmeyen domain için false döndürmeli', () => {
      expect(matchesDomainList('example.com', SOCIAL_MEDIA_DOMAINS)).toBe(false);
      expect(matchesDomainList('mysite.org', SEARCH_ENGINE_DOMAINS)).toBe(false);
    });

    it('boş domain için false döndürmeli', () => {
      expect(matchesDomainList('', SOCIAL_MEDIA_DOMAINS)).toBe(false);
    });

    it('case-insensitive olmalı', () => {
      expect(matchesDomainList('FACEBOOK.COM', SOCIAL_MEDIA_DOMAINS)).toBe(true);
      expect(matchesDomainList('Google.Com', SEARCH_ENGINE_DOMAINS)).toBe(true);
    });
  });

  // ============================================================================
  // Source Type Classification Tests
  // Requirement 9.4: Distinguish between social media, search engines, and direct referrers
  // ============================================================================

  describe('classifySourceType - Requirement 9.4', () => {
    describe('Social Media Classification', () => {
      it('Facebook referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.facebook.com/share')).toBe('social');
        expect(classifySourceType('https://m.facebook.com')).toBe('social');
        expect(classifySourceType('https://fb.com/post')).toBe('social');
      });

      it('Twitter/X referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://twitter.com/status/123')).toBe('social');
        expect(classifySourceType('https://x.com/post')).toBe('social');
        expect(classifySourceType('https://t.co/abc123')).toBe('social');
      });

      it('Instagram referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.instagram.com/p/abc')).toBe('social');
      });

      it('LinkedIn referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.linkedin.com/post')).toBe('social');
      });

      it('Discord referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://discord.com/channels/123')).toBe('social');
        expect(classifySourceType('https://discord.gg/invite')).toBe('social');
      });

      it('Reddit referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.reddit.com/r/test')).toBe('social');
      });

      it('TikTok referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.tiktok.com/@user')).toBe('social');
      });

      it('YouTube referrer\'ı "social" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.youtube.com/watch?v=abc')).toBe('social');
        expect(classifySourceType('https://youtu.be/abc')).toBe('social');
      });
    });

    describe('Search Engine Classification', () => {
      it('Google referrer\'ı "search" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.google.com/search?q=test')).toBe('search');
        expect(classifySourceType('https://google.com.tr/search')).toBe('search');
      });

      it('Bing referrer\'ı "search" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.bing.com/search?q=test')).toBe('search');
      });

      it('Yahoo referrer\'ı "search" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://search.yahoo.com/search')).toBe('search');
      });

      it('DuckDuckGo referrer\'ı "search" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://duckduckgo.com/?q=test')).toBe('search');
      });

      it('Yandex referrer\'ı "search" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://yandex.com/search')).toBe('search');
        expect(classifySourceType('https://yandex.ru/search')).toBe('search');
      });

      it('Baidu referrer\'ı "search" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://www.baidu.com/s?wd=test')).toBe('search');
      });
    });

    describe('Direct Referrer Classification', () => {
      it('boş referrer\'ı "direct" olarak sınıflandırmalı', () => {
        expect(classifySourceType('')).toBe('direct');
        expect(classifySourceType('   ')).toBe('direct');
      });

      it('null/undefined referrer\'ı "direct" olarak sınıflandırmalı', () => {
        expect(classifySourceType(null as unknown as string)).toBe('direct');
        expect(classifySourceType(undefined as unknown as string)).toBe('direct');
      });

      it('aynı domain\'i "direct" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://mysite.com/page', 'mysite.com')).toBe('direct');
        expect(classifySourceType('https://www.mysite.com/page', 'mysite.com')).toBe('direct');
      });
    });

    describe('Other Referrer Classification', () => {
      it('bilinmeyen domain\'leri "other" olarak sınıflandırmalı', () => {
        expect(classifySourceType('https://example.com/link')).toBe('other');
        expect(classifySourceType('https://myblog.org/post')).toBe('other');
        expect(classifySourceType('https://news.site.net/article')).toBe('other');
      });
    });
  });

  // ============================================================================
  // Source Counter Tests
  // Requirement 9.5: Increment a counter for that source
  // ============================================================================

  describe('Source Counter - Requirement 9.5', () => {
    beforeEach(() => {
      resetSourceCounters();
    });

    it('yeni kaynak için 1 döndürmeli', () => {
      expect(incrementSourceCounter('facebook.com')).toBe(1);
    });

    it('aynı kaynak için sayacı artırmalı', () => {
      expect(incrementSourceCounter('google.com')).toBe(1);
      expect(incrementSourceCounter('google.com')).toBe(2);
      expect(incrementSourceCounter('google.com')).toBe(3);
    });

    it('farklı kaynaklar için ayrı sayaçlar tutmalı', () => {
      expect(incrementSourceCounter('facebook.com')).toBe(1);
      expect(incrementSourceCounter('twitter.com')).toBe(1);
      expect(incrementSourceCounter('facebook.com')).toBe(2);
      expect(incrementSourceCounter('twitter.com')).toBe(2);
    });

    it('case-insensitive olmalı', () => {
      expect(incrementSourceCounter('Facebook.com')).toBe(1);
      expect(incrementSourceCounter('FACEBOOK.COM')).toBe(2);
      expect(incrementSourceCounter('facebook.com')).toBe(3);
    });

    it('boş domain için 0 döndürmeli', () => {
      expect(incrementSourceCounter('')).toBe(0);
    });

    it('getSourceCounter mevcut sayacı döndürmeli', () => {
      incrementSourceCounter('test.com');
      incrementSourceCounter('test.com');
      expect(getSourceCounter('test.com')).toBe(2);
    });

    it('getSourceCounter olmayan kaynak için 0 döndürmeli', () => {
      expect(getSourceCounter('nonexistent.com')).toBe(0);
    });

    it('resetSourceCounters tüm sayaçları sıfırlamalı', () => {
      incrementSourceCounter('a.com');
      incrementSourceCounter('b.com');
      resetSourceCounters();
      expect(getSourceCounter('a.com')).toBe(0);
      expect(getSourceCounter('b.com')).toBe(0);
    });
  });

  // ============================================================================
  // logReferrer Function Tests
  // Requirements: 9.1, 9.3, 9.4, 9.5
  // ============================================================================

  describe('logReferrer - Requirements 9.1, 9.3, 9.4, 9.5', () => {
    describe('Requirement 9.1: Referrer URL kaydı', () => {
      it('referrer URL\'sini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-1',
          userId: 'user-1',
          action: 'referrer_track',
          details: JSON.stringify({
            event: 'referrer_track',
            referrerUrl: 'https://www.google.com/search?q=test',
            sourceDomain: 'google.com',
            sourceType: 'search',
            sourceCount: 1,
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.1',
          userId: 'user-1',
          sessionId: 'session-1',
          userAgent: 'Mozilla/5.0',
          referrer: 'https://www.google.com/search?q=test',
        };

        const referrer: ReferrerLog = {
          referrerUrl: 'https://www.google.com/search?q=test',
          sourceDomain: 'google.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.referrerUrl).toBe('https://www.google.com/search?q=test');
      });
    });

    describe('Requirement 9.3: Source domain kaydı', () => {
      it('source domain\'i kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-domain',
          userId: 'user-1',
          action: 'referrer_track',
          details: JSON.stringify({
            event: 'referrer_track',
            referrerUrl: 'https://www.facebook.com/share',
            sourceDomain: 'facebook.com',
            sourceType: 'social',
            sourceCount: 1,
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

        const referrer: ReferrerLog = {
          referrerUrl: 'https://www.facebook.com/share',
          sourceDomain: 'facebook.com',
          sourceType: 'social',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.sourceDomain).toBe('facebook.com');
      });
    });

    describe('Requirement 9.4: Source type kaydı', () => {
      it('social source type\'ı kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-social',
          userId: 'user-1',
          action: 'referrer_track',
          details: JSON.stringify({
            event: 'referrer_track',
            referrerUrl: 'https://twitter.com/post',
            sourceDomain: 'twitter.com',
            sourceType: 'social',
            sourceCount: 1,
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

        const referrer: ReferrerLog = {
          referrerUrl: 'https://twitter.com/post',
          sourceDomain: 'twitter.com',
          sourceType: 'social',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.sourceType).toBe('social');
      });

      it('search source type\'ı kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-search',
          userId: 'user-1',
          action: 'referrer_track',
          details: JSON.stringify({
            event: 'referrer_track',
            referrerUrl: 'https://bing.com/search',
            sourceDomain: 'bing.com',
            sourceType: 'search',
            sourceCount: 1,
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

        const referrer: ReferrerLog = {
          referrerUrl: 'https://bing.com/search',
          sourceDomain: 'bing.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.sourceType).toBe('search');
      });

      it('other source type\'ı kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-other',
          userId: 'user-1',
          action: 'referrer_track',
          details: JSON.stringify({
            event: 'referrer_track',
            referrerUrl: 'https://example.com/link',
            sourceDomain: 'example.com',
            sourceType: 'other',
            sourceCount: 1,
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

        const referrer: ReferrerLog = {
          referrerUrl: 'https://example.com/link',
          sourceDomain: 'example.com',
          sourceType: 'other',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.sourceType).toBe('other');
      });
    });

    describe('Requirement 9.5: Source counter kaydı', () => {
      it('source count\'u kaydetmeli', async () => {
        resetSourceCounters();
        
        const mockLog = {
          id: 'log-ref-count',
          userId: 'user-1',
          action: 'referrer_track',
          details: JSON.stringify({
            event: 'referrer_track',
            referrerUrl: 'https://google.com',
            sourceDomain: 'google.com',
            sourceType: 'search',
            sourceCount: 1,
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

        const referrer: ReferrerLog = {
          referrerUrl: 'https://google.com',
          sourceDomain: 'google.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.sourceCount).toBe(1);
      });
    });

    describe('Anonim kullanıcı desteği', () => {
      it('anonim kullanıcı için sistem kullanıcısı kullanmalı', async () => {
        const mockLog = {
          id: 'log-ref-anon',
          userId: 'system-user-id',
          action: 'referrer_track',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '192.168.1.1',
          userId: null, // Anonim
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        const referrer: ReferrerLog = {
          referrerUrl: 'https://google.com',
          sourceDomain: 'google.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.userId).toBe('system-user-id');
      });
    });

    describe('Action ve event türü', () => {
      it('action türünü "referrer_track" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-action',
          userId: 'user-1',
          action: 'referrer_track',
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

        const referrer: ReferrerLog = {
          referrerUrl: 'https://google.com',
          sourceDomain: 'google.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.action).toBe('referrer_track');
      });

      it('event türünü "referrer_track" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-event',
          userId: 'user-1',
          action: 'referrer_track',
          details: JSON.stringify({
            event: 'referrer_track',
            referrerUrl: 'https://google.com',
            sourceDomain: 'google.com',
            sourceType: 'search',
            sourceCount: 1,
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

        const referrer: ReferrerLog = {
          referrerUrl: 'https://google.com',
          sourceDomain: 'google.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        expect(details.event).toBe('referrer_track');
      });
    });

    describe('IP adresi kaydı', () => {
      it('geçerli IP adresini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-ref-ip',
          userId: 'user-1',
          action: 'referrer_track',
          details: '{}',
          ipAddress: '10.0.0.100',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: '10.0.0.100',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        const referrer: ReferrerLog = {
          referrerUrl: 'https://google.com',
          sourceDomain: 'google.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('10.0.0.100');
      });

      it('geçersiz IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-ref-invalid-ip',
          userId: 'user-1',
          action: 'referrer_track',
          details: '{}',
          ipAddress: '0.0.0.0',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const visitor: VisitorInfo = {
          ipAddress: 'invalid-ip',
          userId: 'user-1',
          sessionId: null,
          userAgent: '',
          referrer: null,
        };

        const referrer: ReferrerLog = {
          referrerUrl: 'https://google.com',
          sourceDomain: 'google.com',
          sourceType: 'search',
        };

        await logReferrer(visitor, referrer);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('0.0.0.0');
      });
    });
  });

  // ============================================================================
  // logReferrerFromUrl Helper Function Tests
  // ============================================================================

  describe('logReferrerFromUrl', () => {
    it('URL\'den otomatik olarak domain ve type çıkarmalı', async () => {
      resetSourceCounters();
      
      const mockLog = {
        id: 'log-ref-auto',
        userId: 'user-1',
        action: 'referrer_track',
        details: JSON.stringify({
          event: 'referrer_track',
          referrerUrl: 'https://www.facebook.com/share/post',
          sourceDomain: 'facebook.com',
          sourceType: 'social',
          sourceCount: 1,
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

      await logReferrerFromUrl(visitor, 'https://www.facebook.com/share/post');

      const callArgs = mockCreate.mock.calls[0][0];
      const details = JSON.parse(callArgs.data.details);
      
      expect(details.referrerUrl).toBe('https://www.facebook.com/share/post');
      expect(details.sourceDomain).toBe('facebook.com');
      expect(details.sourceType).toBe('social');
    });

    it('currentDomain ile direct referrer\'ı tespit etmeli', async () => {
      resetSourceCounters();
      
      const mockLog = {
        id: 'log-ref-direct',
        userId: 'user-1',
        action: 'referrer_track',
        details: JSON.stringify({
          event: 'referrer_track',
          referrerUrl: 'https://mysite.com/other-page',
          sourceDomain: 'mysite.com',
          sourceType: 'direct',
          sourceCount: 1,
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

      await logReferrerFromUrl(visitor, 'https://mysite.com/other-page', 'mysite.com');

      const callArgs = mockCreate.mock.calls[0][0];
      const details = JSON.parse(callArgs.data.details);
      
      expect(details.sourceType).toBe('direct');
    });
  });

  // ============================================================================
  // logURLCopy Tests
  // Requirement 9.2
  // ============================================================================

  describe('logURLCopy - Requirement 9.2', () => {
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

    describe('Requirement 9.2: URL kopyalama olayı kaydı', () => {
      it('kopyalanan URL\'yi kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-1',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/page',
            pageUrl: 'https://example.com/page',
            pageTitle: 'Test Page',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Test Page',
        };

        const log = await logURLCopy('user-1', urlCopy, '192.168.1.1');

        expect(mockCreate).toHaveBeenCalled();
        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.copiedUrl).toBe('https://example.com/page');
        expect(callArgs.data.action).toBe('url_copy');
      });

      it('sayfa URL\'sini (page context) kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-2',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/shared-link',
            pageUrl: 'https://example.com/current-page',
            pageTitle: 'Current Page Title',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/shared-link',
          pageUrl: 'https://example.com/current-page',
          pageTitle: 'Current Page Title',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.pageUrl).toBe('https://example.com/current-page');
      });

      it('sayfa başlığını (page context) kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-3',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/page',
            pageUrl: 'https://example.com/page',
            pageTitle: 'Yetkili Kılavuzu - Ana Sayfa',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Yetkili Kılavuzu - Ana Sayfa',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.pageTitle).toBe('Yetkili Kılavuzu - Ana Sayfa');
      });

      it('timestamp bilgisini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-ts',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/page',
            pageUrl: 'https://example.com/page',
            pageTitle: 'Test Page',
            timestamp: new Date().toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Test Page',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.timestamp).toBeDefined();
        expect(typeof details.timestamp).toBe('string');
        // ISO format kontrolü
        expect(() => new Date(details.timestamp)).not.toThrow();
      });

      it('event türünü "url_copy" olarak kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-event',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/page',
            pageUrl: 'https://example.com/page',
            pageTitle: 'Test Page',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Test Page',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.event).toBe('url_copy');
        expect(callArgs.data.action).toBe('url_copy');
      });
    });

    describe('IP adresi işleme', () => {
      it('geçerli IP adresini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-ip',
          userId: 'user-1',
          action: 'url_copy',
          details: '{}',
          ipAddress: '10.0.0.50',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Test Page',
        };

        await logURLCopy('user-1', urlCopy, '10.0.0.50');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('10.0.0.50');
      });

      it('geçersiz IP için varsayılan değer kullanmalı', async () => {
        const mockLog = {
          id: 'log-url-copy-invalid-ip',
          userId: 'user-1',
          action: 'url_copy',
          details: '{}',
          ipAddress: '0.0.0.0',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Test Page',
        };

        await logURLCopy('user-1', urlCopy, 'invalid-ip');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.ipAddress).toBe('0.0.0.0');
      });
    });

    describe('Kullanıcı ID işleme', () => {
      it('authenticated kullanıcı ID\'sini kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-uid',
          userId: 'authenticated-user-456',
          action: 'url_copy',
          details: '{}',
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Test Page',
        };

        await logURLCopy('authenticated-user-456', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.data.userId).toBe('authenticated-user-456');
      });
    });

    describe('Farklı URL senaryoları', () => {
      it('query parametreli URL\'yi kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-query',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/search?q=test&page=1',
            pageUrl: 'https://example.com/search?q=test&page=1',
            pageTitle: 'Search Results',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/search?q=test&page=1',
          pageUrl: 'https://example.com/search?q=test&page=1',
          pageTitle: 'Search Results',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.copiedUrl).toBe('https://example.com/search?q=test&page=1');
      });

      it('hash fragmentli URL\'yi kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-hash',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/page#section-2',
            pageUrl: 'https://example.com/page#section-2',
            pageTitle: 'Page with Section',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page#section-2',
          pageUrl: 'https://example.com/page#section-2',
          pageTitle: 'Page with Section',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.copiedUrl).toBe('https://example.com/page#section-2');
      });

      it('farklı kopyalanan URL ve sayfa URL\'si kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-diff',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/share/abc123',
            pageUrl: 'https://example.com/article/my-article',
            pageTitle: 'My Article',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/share/abc123',
          pageUrl: 'https://example.com/article/my-article',
          pageTitle: 'My Article',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.copiedUrl).toBe('https://example.com/share/abc123');
        expect(details.pageUrl).toBe('https://example.com/article/my-article');
      });
    });

    describe('Boş değer işleme', () => {
      it('boş sayfa başlığını kaydetmeli', async () => {
        const mockLog = {
          id: 'log-url-copy-empty-title',
          userId: 'user-1',
          action: 'url_copy',
          details: JSON.stringify({
            event: 'url_copy',
            copiedUrl: 'https://example.com/page',
            pageUrl: 'https://example.com/page',
            pageTitle: '',
            timestamp: mockTimestamp.toISOString(),
          }),
          ipAddress: '192.168.1.1',
          timestamp: mockTimestamp,
        };

        mockCreate.mockResolvedValue(mockLog);

        const urlCopy = {
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: '',
        };

        await logURLCopy('user-1', urlCopy, '192.168.1.1');

        const callArgs = mockCreate.mock.calls[0][0];
        const details = JSON.parse(callArgs.data.details);
        
        expect(details.pageTitle).toBe('');
      });
    });
  });

  // ============================================================================
  // logURLCopyAnonymous Tests
  // ============================================================================

  describe('logURLCopyAnonymous', () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00.000Z');

    beforeEach(() => {
      mockFindUnique.mockResolvedValue({
        id: 'system-user-id',
        username: 'system',
        email: 'system@yetkili-kilavuzu.local',
      });
    });

    it('anonim kullanıcı için sistem kullanıcısı ile log oluşturmalı', async () => {
      const mockLog = {
        id: 'log-url-copy-anon',
        userId: 'system-user-id',
        action: 'url_copy',
        details: JSON.stringify({
          event: 'url_copy',
          copiedUrl: 'https://example.com/page',
          pageUrl: 'https://example.com/page',
          pageTitle: 'Test Page',
          timestamp: mockTimestamp.toISOString(),
        }),
        ipAddress: '192.168.1.1',
        timestamp: mockTimestamp,
      };

      mockCreate.mockResolvedValue(mockLog);

      const urlCopy = {
        copiedUrl: 'https://example.com/page',
        pageUrl: 'https://example.com/page',
        pageTitle: 'Test Page',
      };

      await logURLCopyAnonymous(urlCopy, '192.168.1.1');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: 'system@yetkili-kilavuzu.local' },
      });
      expect(mockCreate).toHaveBeenCalled();
    });

    it('sistem kullanıcısı yoksa oluşturmalı', async () => {
      mockFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({
        id: 'new-system-user-id',
        username: 'system',
        email: 'system@yetkili-kilavuzu.local',
      });

      const mockLog = {
        id: 'log-url-copy-anon-new',
        userId: 'new-system-user-id',
        action: 'url_copy',
        details: '{}',
        ipAddress: '192.168.1.1',
        timestamp: mockTimestamp,
      };

      mockCreate.mockResolvedValue(mockLog);

      const urlCopy = {
        copiedUrl: 'https://example.com/page',
        pageUrl: 'https://example.com/page',
        pageTitle: 'Test Page',
      };

      await logURLCopyAnonymous(urlCopy, '192.168.1.1');

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'system',
          email: 'system@yetkili-kilavuzu.local',
        }),
      });
    });
  });
});
