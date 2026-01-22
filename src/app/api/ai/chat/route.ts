/**
 * AI Chat API Endpoint
 * RAG tabanlı ceza danışmanlığı sohbet endpoint'i
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * - 4.1: OPENAI_API_KEY yoksa fallback mock yanıtlar kullan
 * - 4.2: API hatası olduğunda kullanıcı dostu hata mesajı göster
 * - 4.3: API key kontrolü yap
 * - 4.4: Mock modda keyword bazlı yanıtlar ver
 * - 4.5: AI servisi kullanılamıyorsa kullanıcıyı bilgilendir
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import {
  chat,
  type ChatMessage,
  type AIResponse,
  type PenaltyRecord,
  isAIServiceAvailable,
  generateEnhancedMockResponse,
} from '@/lib/ai-assistant';

/**
 * Chat isteği body tipi
 */
interface ChatRequestBody {
  /** Kullanıcı mesajı */
  message: string;
  /** Konuşma ID'si (opsiyonel, gelecekte kullanılabilir) */
  conversationId?: string;
  /** Konuşma geçmişi (opsiyonel) */
  conversationHistory?: ChatMessage[];
}

/**
 * Chat yanıt tipi
 */
interface ChatResponseBody {
  success: boolean;
  response?: string;
  penaltyRecord?: PenaltyRecord | undefined;
  sources?: Array<{
    id: string;
    title: string;
    type: string;
    category: string;
    relevanceScore: number;
  }>;
  confidence?: 'high' | 'medium' | 'low';
  error?: string;
  code?: string;
}

/**
 * POST /api/ai/chat
 * AI sohbet endpoint'i
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export const POST = withAuth<ChatResponseBody>(
  async (request: NextRequest, { user: _user }) => {
    try {
      // Request body'yi parse et
      const body: ChatRequestBody = await request.json();

      // Mesaj validasyonu
      if (!body.message || typeof body.message !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'Mesaj alanı zorunludur',
            code: 'INVALID_MESSAGE',
          },
          { status: 400 }
        );
      }

      const message = body.message.trim();

      if (message.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Mesaj boş olamaz',
            code: 'EMPTY_MESSAGE',
          },
          { status: 400 }
        );
      }

      if (message.length > 2000) {
        return NextResponse.json(
          {
            success: false,
            error: 'Mesaj 2000 karakterden uzun olamaz',
            code: 'MESSAGE_TOO_LONG',
          },
          { status: 400 }
        );
      }

      // Konuşma geçmişi validasyonu
      const conversationHistory: ChatMessage[] = [];
      if (body.conversationHistory && Array.isArray(body.conversationHistory)) {
        for (const msg of body.conversationHistory) {
          if (
            msg &&
            typeof msg.role === 'string' &&
            typeof msg.content === 'string' &&
            (msg.role === 'user' || msg.role === 'assistant')
          ) {
            conversationHistory.push({
              role: msg.role,
              content: msg.content,
            });
          }
        }
        // Maksimum 10 mesaj geçmişi
        if (conversationHistory.length > 10) {
          conversationHistory.splice(0, conversationHistory.length - 10);
        }
      }

      // AI servisinin kullanılabilirliğini kontrol et
      const aiAvailable = isAIServiceAvailable();
      const useMock = !aiAvailable;

      // Mock modda olduğumuzu logla (debug için)
      if (useMock) {
        console.log('AI Chat: Mock mod aktif (OPENAI_API_KEY yapılandırılmamış)');
      }

      // AI yanıtı oluştur
      let aiResponse: AIResponse;
      
      try {
        aiResponse = await chat({
          message,
          conversationHistory,
          useMock,
        });
      } catch (chatError) {
        // Chat fonksiyonu hata verirse, fallback olarak enhanced mock yanıt kullan
        console.error('AI Chat error, falling back to mock:', chatError);
        
        const mockResponse = generateEnhancedMockResponse(message);
        return NextResponse.json({
          success: true,
          response: mockResponse,
          sources: [],
          confidence: 'medium' as const,
          _mockMode: true,
        });
      }

      // Başarılı yanıt
      return NextResponse.json({
        success: true,
        response: aiResponse.response,
        penaltyRecord: aiResponse.penaltyRecord,
        sources: aiResponse.sources.map((source) => ({
          id: source.id,
          title: source.title,
          type: source.type,
          category: source.category,
          relevanceScore: source.relevanceScore,
        })),
        confidence: aiResponse.confidence,
        _mockMode: useMock,
      });
    } catch (error) {
      console.error('AI Chat error:', error);

      // JSON parse hatası
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Geçersiz istek formatı',
            code: 'INVALID_JSON',
          },
          { status: 400 }
        );
      }

      // OpenAI API hatası
      if (error instanceof Error && error.message.includes('AI servisi')) {
        // Fallback: Mock yanıt döndür
        try {
          const body = await request.clone().json();
          const mockResponse = generateEnhancedMockResponse(body.message || '');
          return NextResponse.json({
            success: true,
            response: mockResponse,
            sources: [],
            confidence: 'medium' as const,
            _mockMode: true,
            _fallback: true,
          });
        } catch {
          return NextResponse.json(
            {
              success: false,
              error: 'AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin veya kılavuzu manuel olarak inceleyin.',
              code: 'AI_SERVICE_ERROR',
            },
            { status: 503 }
          );
        }
      }

      // Rate limit hatası
      if (error instanceof Error && error.message.includes('rate')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Çok fazla istek gönderildi, lütfen birkaç saniye bekleyin',
            code: 'RATE_LIMIT',
          },
          { status: 429 }
        );
      }

      // Genel hata - fallback olarak mock yanıt dene
      try {
        const body = await request.clone().json();
        if (body.message) {
          const mockResponse = generateEnhancedMockResponse(body.message);
          return NextResponse.json({
            success: true,
            response: mockResponse,
            sources: [],
            confidence: 'low' as const,
            _mockMode: true,
            _fallback: true,
          });
        }
      } catch {
        // Fallback da başarısız oldu
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Bir hata oluştu. Lütfen sorunuzu farklı şekilde sormayı deneyin.',
          code: 'INTERNAL_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'mod' }
);

/**
 * GET /api/ai/chat
 * AI servis durumu kontrolü
 * Requirements: 4.3, 4.5
 */
export const GET = withAuth<{ available: boolean; message: string; mockMode: boolean }>(
  async () => {
    const available = isAIServiceAvailable();

    return NextResponse.json({
      available,
      mockMode: !available,
      message: available
        ? 'AI servisi kullanılabilir (OpenAI API aktif)'
        : 'AI servisi mock modda çalışıyor (OPENAI_API_KEY yapılandırılmamış). Temel sorulara yanıt verebilir.',
    });
  },
  { requiredRole: 'mod' }
);
