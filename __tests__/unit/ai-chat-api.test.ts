/**
 * AI Chat API Unit Tests
 * AI sohbet API endpoint'i için unit testler
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * 
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock ai-assistant module
jest.mock('@/lib/ai-assistant', () => ({
  chat: jest.fn(),
  isAIServiceAvailable: jest.fn(() => true),
}));

// Mock api-auth module
jest.mock('@/lib/api-auth', () => ({
  withAuth: jest.fn((handler, _options) => {
    return async (request: NextRequest, context: { params: Record<string, string> }) => {
      // Simulate authenticated user
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        status: 'approved' as const,
        role: 'mod' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return handler(request, { ...context, user: mockUser });
    };
  }),
}));

// Mock rag module
jest.mock('@/lib/rag', () => ({
  retrieveContext: jest.fn(),
  retrievePenaltyContext: jest.fn(),
  determineConfidenceLevel: jest.fn(() => 'high'),
  formatSourcesForCitation: jest.fn(() => ''),
}));

// Mock vector-store module
jest.mock('@/lib/vector-store', () => ({
  initializeVectorStore: jest.fn(),
  isVectorStoreInitialized: jest.fn(() => true),
}));

import { POST, GET } from '@/app/api/ai/chat/route';
import { chat, isAIServiceAvailable } from '@/lib/ai-assistant';

const mockChat = chat as jest.MockedFunction<typeof chat>;
const mockIsAIServiceAvailable = isAIServiceAvailable as jest.MockedFunction<
  typeof isAIServiceAvailable
>;

describe('AI Chat API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/ai/chat', () => {
    const createRequest = (body: object): NextRequest => {
      return new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    it('geçerli mesaj için başarılı yanıt döndürmeli', async () => {
      mockChat.mockResolvedValue({
        response: 'ADK cezası 7 gündür.',
        sources: [
          {
            id: 'penalty-adk',
            title: 'ADK Cezası',
            type: 'penalty',
            category: 'yazili',
            relevanceScore: 0.85,
          },
        ],
        confidence: 'high',
        contextUsed: true,
      });

      const request = createRequest({ message: 'adk cezası kaç gün?' });
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.response).toBe('ADK cezası 7 gündür.');
      expect(data.confidence).toBe('high');
      expect(data.sources).toHaveLength(1);
    });

    it('ceza kaydı içeren yanıt döndürmeli', async () => {
      mockChat.mockResolvedValue({
        response: 'Ceza önerisi...',
        penaltyRecord: {
          violation: 'ADK İhlali',
          article: 'Madde 3.2',
          duration: '7 gün',
          reason: 'Aşırı duygu kontrolü',
          copyableText: '📋 CEZA KAYDI...',
        },
        sources: [],
        confidence: 'high',
        contextUsed: true,
      });

      const request = createRequest({ message: 'adk ihlali için ceza ver' });
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.penaltyRecord).toBeDefined();
      expect(data.penaltyRecord.violation).toBe('ADK İhlali');
      expect(data.penaltyRecord.duration).toBe('7 gün');
    });

    it('boş mesaj için hata döndürmeli', async () => {
      const request = createRequest({ message: '' });
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('INVALID_MESSAGE');
    });

    it('mesaj alanı olmadan hata döndürmeli', async () => {
      const request = createRequest({});
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('INVALID_MESSAGE');
    });

    it('çok uzun mesaj için hata döndürmeli', async () => {
      const longMessage = 'a'.repeat(2001);
      const request = createRequest({ message: longMessage });
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('MESSAGE_TOO_LONG');
    });

    it('konuşma geçmişi ile çalışmalı', async () => {
      mockChat.mockResolvedValue({
        response: 'Devam yanıtı',
        sources: [],
        confidence: 'medium',
        contextUsed: true,
      });

      const request = createRequest({
        message: 'devam et',
        conversationHistory: [
          { role: 'user', content: 'merhaba' },
          { role: 'assistant', content: 'merhaba, nasıl yardımcı olabilirim?' },
        ],
      });

      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationHistory: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'merhaba' }),
          ]),
        })
      );
    });

    it('AI servisi hatası için 503 döndürmeli', async () => {
      mockChat.mockRejectedValue(new Error('AI servisi hatası'));

      const request = createRequest({ message: 'test' });
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.code).toBe('AI_SERVICE_ERROR');
    });

    it('rate limit hatası için 429 döndürmeli', async () => {
      mockChat.mockRejectedValue(new Error('rate limit exceeded'));

      const request = createRequest({ message: 'test' });
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.code).toBe('RATE_LIMIT');
    });

    it('genel hata için 500 döndürmeli', async () => {
      mockChat.mockRejectedValue(new Error('Bilinmeyen hata'));

      const request = createRequest({ message: 'test' });
      const response = await POST(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/ai/chat', () => {
    const createGetRequest = (): NextRequest => {
      return new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'GET',
      });
    };

    it('AI servisi kullanılabilir olduğunda true döndürmeli', async () => {
      mockIsAIServiceAvailable.mockReturnValue(true);

      const request = createGetRequest();
      const response = await GET(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(true);
      expect(data.message).toContain('kullanılabilir');
    });

    it('AI servisi kullanılamaz olduğunda false döndürmeli', async () => {
      mockIsAIServiceAvailable.mockReturnValue(false);

      const request = createGetRequest();
      const response = await GET(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.message).toContain('yapılandırılmamış');
    });
  });
});

describe('AI Chat API - Confidence Levels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (message: string): NextRequest => {
    return new NextRequest('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  };

  it('yüksek güven seviyesi döndürmeli (Requirement 6.1)', async () => {
    mockChat.mockResolvedValue({
      response: 'Kesin yanıt',
      sources: [{ id: '1', title: 'Kaynak', type: 'penalty', category: 'yazili', relevanceScore: 0.9 }],
      confidence: 'high',
      contextUsed: true,
    });

    const response = await POST(createRequest('adk cezası'), { params: {} });
    const data = await response.json();

    expect(data.confidence).toBe('high');
  });

  it('orta güven seviyesi döndürmeli', async () => {
    mockChat.mockResolvedValue({
      response: 'Olası yanıt',
      sources: [{ id: '1', title: 'Kaynak', type: 'guide', category: 'kilavuz', relevanceScore: 0.5 }],
      confidence: 'medium',
      contextUsed: true,
    });

    const response = await POST(createRequest('genel soru'), { params: {} });
    const data = await response.json();

    expect(data.confidence).toBe('medium');
  });

  it('düşük güven seviyesi döndürmeli (Requirement 6.5)', async () => {
    mockChat.mockResolvedValue({
      response: 'Bu durumda üst yetkililere danışılmalıdır.',
      sources: [],
      confidence: 'low',
      contextUsed: false,
    });

    const response = await POST(createRequest('bilinmeyen konu'), { params: {} });
    const data = await response.json();

    expect(data.confidence).toBe('low');
    expect(data.response).toContain('üst yetkililere');
  });
});
