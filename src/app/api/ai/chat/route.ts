/**
 * AI Chat API Endpoint
 * RAG tabanlı ceza danışmanlığı sohbet endpoint'i
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * - 6.1: AI ceza sorusu için site içeriğinden doğru ceza süresini bulup yanıtlamalı
 * - 6.2: Olay anlatımı için ihlali analiz etmeli, uygun cezayı belirtmeli
 * - 6.3: Ceza maddesini, süreyi, gerekçeyi ve alternatif durumları belirtmeli
 * - 6.4: Sadece "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermeli
 * - 6.5: Emin değilse "Bu durumda üst yetkililere danışılmalıdır." yanıtını vermeli
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import {
  chat,
  type ChatMessage,
  type AIResponse,
  type PenaltyRecord,
  isAIServiceAvailable,
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
      const useMock = !isAIServiceAvailable();

      // AI yanıtı oluştur
      const aiResponse: AIResponse = await chat({
        message,
        conversationHistory,
        useMock,
      });

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
      });
    } catch (error) {
      console.error('AI Chat error:', error);

      // OpenAI API hatası
      if (error instanceof Error && error.message.includes('AI servisi')) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI servisi şu anda kullanılamıyor, lütfen daha sonra tekrar deneyin',
            code: 'AI_SERVICE_ERROR',
          },
          { status: 503 }
        );
      }

      // Rate limit hatası
      if (error instanceof Error && error.message.includes('rate')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Çok fazla istek gönderildi, lütfen bekleyin',
            code: 'RATE_LIMIT',
          },
          { status: 429 }
        );
      }

      // Genel hata
      return NextResponse.json(
        {
          success: false,
          error: 'Bir hata oluştu, lütfen tekrar deneyin',
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
 */
export const GET = withAuth<{ available: boolean; message: string }>(
  async () => {
    const available = isAIServiceAvailable();

    return NextResponse.json({
      available,
      message: available
        ? 'AI servisi kullanılabilir'
        : 'AI servisi yapılandırılmamış (OPENAI_API_KEY eksik)',
    });
  },
  { requiredRole: 'mod' }
);
