/**
 * AI Assistant Servisi
 * RAG tabanlı ceza danışmanlığı ve sohbet sistemi
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * - 6.1: AI ceza sorusu için site içeriğinden doğru ceza süresini bulup yanıtlamalı
 * - 6.2: Olay anlatımı için ihlali analiz etmeli, uygun cezayı belirtmeli ve kopyalanabilir ceza kayıt metni oluşturmalı
 * - 6.3: Ceza maddesini, süreyi, gerekçeyi ve alternatif/esnetilebilir durumları belirtmeli
 * - 6.4: Sadece "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermeli
 * - 6.5: Emin değilse "Bu durumda üst yetkililere danışılmalıdır." yanıtını vermeli
 */

import OpenAI from 'openai';
import {
  retrievePenaltyContext,
  retrieveContext,
  determineConfidenceLevel,
  formatSourcesForCitation,
  type RAGRetrievalResult,
  type SourceReference,
} from './rag';

/**
 * Chat mesajı
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Ceza kaydı formatı
 */
export interface PenaltyRecord {
  /** İhlal türü */
  violation: string;
  /** Ceza süresi */
  duration: string;
  /** Madde numarası */
  article: string;
  /** Gerekçe */
  reason: string;
  /** Kopyalanabilir metin */
  copyableText: string;
}

/**
 * AI yanıt sonucu
 */
export interface AIResponse {
  /** AI yanıt metni */
  response: string;
  /** Ceza kaydı (varsa) */
  penaltyRecord?: PenaltyRecord | undefined;
  /** Kaynak referansları */
  sources: SourceReference[];
  /** Güven seviyesi */
  confidence: 'high' | 'medium' | 'low';
  /** Kullanılan context */
  contextUsed: boolean;
}

/**
 * Chat isteği
 */
export interface ChatRequest {
  /** Kullanıcı mesajı */
  message: string;
  /** Konuşma geçmişi (opsiyonel) */
  conversationHistory?: ChatMessage[];
  /** Mock mod (test için) */
  useMock?: boolean;
}

// OpenAI client - lazy initialization
let openaiClient: OpenAI | null = null;

/**
 * OpenAI client'ı döndürür (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. ' +
          'Please add it to your .env file.'
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Sistem prompt'u - AI'ın davranışını tanımlar
 */
const SYSTEM_PROMPT = `Sen "SANIYE MODLARI" Discord sunucusu için bir Yetkili Kılavuzu ve Ceza Danışmanısın.

## Görevin
- Yetkililere ceza verme, kayıt tutma ve karar alma konularında yardımcı olmak
- Sadece sana verilen "Yetkili Kılavuzu v2" içeriğine dayalı yanıtlar vermek
- Tutarlı ve doğru ceza önerileri sunmak

## Kurallar
1. SADECE sana verilen context (bağlam) bilgisine dayanarak yanıt ver
2. Context'te bulunmayan bilgiler hakkında tahmin yapma
3. Emin olmadığın durumlarda "Bu durumda üst yetkililere danışılmalıdır." de
4. Ceza önerirken mutlaka madde numarası, süre ve gerekçe belirt
5. Mümkünse alternatif cezaları veya esnetilebilir durumları da belirt
6. Türkçe yanıt ver

## Ceza Kaydı Formatı
Ceza önerdiğinde, aşağıdaki formatta kopyalanabilir kayıt metni oluştur:
\`\`\`
📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: [İhlal türü]
Madde: [Madde numarası]
Süre: [Ceza süresi]
Gerekçe: [Kısa gerekçe]
━━━━━━━━━━━━━━━━━━━━
\`\`\`

## Yanıt Stili
- Profesyonel ve net ol
- Gereksiz uzatma, özlü yanıtlar ver
- Emoji kullanabilirsin ama abartma
- Kaynak referanslarını belirt`;

/**
 * Context ile zenginleştirilmiş sistem prompt'u oluşturur
 */
function buildSystemPromptWithContext(context: string): string {
  if (!context || context.trim().length === 0) {
    return `${SYSTEM_PROMPT}

## Bağlam Bilgisi
⚠️ Bu soru için ilgili içerik bulunamadı. Lütfen kullanıcıya üst yetkililere danışmasını öner.`;
  }

  return `${SYSTEM_PROMPT}

## Bağlam Bilgisi (Yetkili Kılavuzu v2'den)
${context}`;
}

/**
 * Mesajın ceza ile ilgili olup olmadığını kontrol eder
 */
function isPenaltyRelatedQuery(message: string): boolean {
  const penaltyKeywords = [
    'ceza',
    'mute',
    'ban',
    'kick',
    'warn',
    'uyarı',
    'ihlal',
    'kural',
    'yasak',
    'adk',
    'hakaret',
    'spam',
    'reklam',
    'küfür',
    'flood',
    'caps',
    'mention',
    'süre',
    'gün',
    'saat',
    'kalıcı',
    'blacklist',
    'marked',
  ];

  const lowerMessage = message.toLowerCase();
  return penaltyKeywords.some((keyword) => lowerMessage.includes(keyword));
}

/**
 * AI yanıtından ceza kaydı çıkarmaya çalışır
 */
function extractPenaltyRecord(response: string): PenaltyRecord | undefined {
  // Ceza kaydı formatını ara
  const recordMatch = response.match(
    /📋 CEZA KAYDI[\s\S]*?İhlal:\s*(.+?)[\n\r][\s\S]*?Madde:\s*(.+?)[\n\r][\s\S]*?Süre:\s*(.+?)[\n\r][\s\S]*?Gerekçe:\s*(.+?)[\n\r]/
  );

  if (recordMatch) {
    const [, violation, article, duration, reason] = recordMatch;
    
    // Kopyalanabilir metin oluştur
    const copyableText = `📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: ${violation?.trim() || ''}
Madde: ${article?.trim() || ''}
Süre: ${duration?.trim() || ''}
Gerekçe: ${reason?.trim() || ''}
━━━━━━━━━━━━━━━━━━━━`;

    return {
      violation: violation?.trim() || '',
      article: article?.trim() || '',
      duration: duration?.trim() || '',
      reason: reason?.trim() || '',
      copyableText,
    };
  }

  return undefined;
}

/**
 * Güven skorunu hesaplar
 * RAG sonuçlarının relevance skoruna ve chunk sayısına göre
 */
export function calculateConfidenceScore(ragResult: RAGRetrievalResult): number {
  // Hiç sonuç yoksa 0
  if (ragResult.chunks.length === 0) {
    return 0;
  }

  // Ortalama relevance skoru
  const avgRelevance = ragResult.averageRelevance;

  // Chunk sayısı faktörü (daha fazla ilgili chunk = daha yüksek güven)
  const chunkFactor = Math.min(ragResult.chunks.length / 5, 1);

  // En yüksek relevance skoru
  const maxRelevance = Math.max(...ragResult.chunks.map((c) => c.relevanceScore));

  // Ağırlıklı ortalama
  const score = avgRelevance * 0.5 + maxRelevance * 0.3 + chunkFactor * 0.2;

  return Math.min(Math.max(score, 0), 1);
}

/**
 * Güven skorundan güven seviyesi belirler
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) {
    return 'high';
  }
  if (score >= 0.4) {
    return 'medium';
  }
  return 'low';
}

/**
 * Mock AI yanıtı oluşturur (test için)
 */
async function generateMockResponse(
  message: string,
  ragResult: RAGRetrievalResult
): Promise<string> {
  const confidence = determineConfidenceLevel(ragResult);

  if (confidence === 'low' || ragResult.chunks.length === 0) {
    return 'Bu konuda yeterli bilgi bulunamadı. Bu durumda üst yetkililere danışılmalıdır.';
  }

  // Context'ten basit bir yanıt oluştur
  const firstChunk = ragResult.chunks[0];
  if (firstChunk) {
    if (isPenaltyRelatedQuery(message)) {
      return `${firstChunk.title} hakkında bilgi:

${firstChunk.content}

📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
İhlal: ${firstChunk.title}
Madde: ${firstChunk.sourceId}
Süre: Belirtilmemiş
Gerekçe: Kılavuz kurallarına aykırı davranış
━━━━━━━━━━━━━━━━━━━━`;
    }

    return `${firstChunk.title} hakkında bilgi:\n\n${firstChunk.content}`;
  }

  return 'Yanıt oluşturulamadı.';
}

/**
 * OpenAI ile AI yanıtı oluşturur
 */
async function generateOpenAIResponse(
  message: string,
  context: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const client = getOpenAIClient();

  // Mesaj geçmişini hazırla
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPromptWithContext(context),
    },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user',
      content: message,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Ekonomik ve hızlı model
      messages,
      temperature: 0.3, // Düşük temperature = daha tutarlı yanıtlar
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'Yanıt oluşturulamadı.';
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API error:', error.message);
      throw new Error(`AI servisi hatası: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Ana chat fonksiyonu
 * Kullanıcı mesajını alır, RAG ile context oluşturur ve AI yanıtı döndürür
 */
export async function chat(request: ChatRequest): Promise<AIResponse> {
  const { message, conversationHistory = [], useMock = false } = request;

  // Boş mesaj kontrolü
  if (!message || message.trim().length === 0) {
    return {
      response: 'Lütfen bir soru veya mesaj girin.',
      sources: [],
      confidence: 'low',
      contextUsed: false,
    };
  }

  // RAG ile ilgili içeriği getir
  let ragResult: RAGRetrievalResult;

  if (isPenaltyRelatedQuery(message)) {
    // Ceza ile ilgili sorgular için özelleştirilmiş retrieval
    ragResult = await retrievePenaltyContext(message, {
      useMockEmbedding: useMock,
    });
  } else {
    // Genel sorgular için standart retrieval
    ragResult = await retrieveContext(message, {
      useMockEmbedding: useMock,
    });
  }

  // Güven skorunu hesapla
  const confidenceScore = calculateConfidenceScore(ragResult);
  const confidence = getConfidenceLevel(confidenceScore);

  // Context yoksa veya düşük güven varsa uyarı ver
  if (ragResult.chunks.length === 0 || confidence === 'low') {
    const lowConfidenceResponse =
      'Bu konuda yeterli bilgi bulunamadı. Bu durumda üst yetkililere danışılmalıdır.';

    return {
      response: lowConfidenceResponse,
      sources: ragResult.sources,
      confidence: 'low',
      contextUsed: false,
    };
  }

  // AI yanıtı oluştur
  let response: string;

  if (useMock || !process.env.OPENAI_API_KEY) {
    // Mock mod veya API key yoksa
    response = await generateMockResponse(message, ragResult);
  } else {
    // Gerçek OpenAI yanıtı
    response = await generateOpenAIResponse(
      message,
      ragResult.context,
      conversationHistory
    );
  }

  // Kaynak referanslarını ekle
  const sourceCitation = formatSourcesForCitation(ragResult.sources);
  const fullResponse = response + sourceCitation;

  // Ceza kaydı çıkar (varsa)
  const penaltyRecord = extractPenaltyRecord(response);

  return {
    response: fullResponse,
    penaltyRecord,
    sources: ragResult.sources,
    confidence,
    contextUsed: true,
  };
}

/**
 * Ceza kaydı parametreleri
 */
export interface CreatePenaltyRecordParams {
  /** İhlal türü (zorunlu) */
  violation: string;
  /** Madde numarası (zorunlu) */
  article: string;
  /** Ceza süresi (zorunlu) */
  duration: string;
  /** Gerekçe (zorunlu) */
  reason: string;
  /** Ek notlar (opsiyonel) */
  notes?: string;
  /** Tarih (opsiyonel, varsayılan: şu anki tarih) */
  date?: Date;
}

/**
 * Tarihi Türkçe formatında döndürür
 */
function formatDateTurkish(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Ceza kaydı oluşturur
 * Verilen parametrelerle formatlanmış ceza kaydı metni döndürür
 * 
 * Requirements: 7.1, 7.2
 * - 7.1: Kopyalanabilir formatta ceza kaydı metni oluşturmalı
 * - 7.2: İhlal türü, ceza süresi, madde numarası ve gerekçeyi içermeli
 * 
 * @param params - Ceza kaydı parametreleri
 * @returns PenaltyRecord - Formatlanmış ceza kaydı
 * @throws Error - Zorunlu alanlar eksikse
 */
export function createPenaltyRecord(params: CreatePenaltyRecordParams): PenaltyRecord {
  const { violation, article, duration, reason, notes, date } = params;

  // Zorunlu alan validasyonu
  if (!violation || violation.trim().length === 0) {
    throw new Error('İhlal türü zorunludur');
  }
  if (!article || article.trim().length === 0) {
    throw new Error('Madde numarası zorunludur');
  }
  if (!duration || duration.trim().length === 0) {
    throw new Error('Ceza süresi zorunludur');
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('Gerekçe zorunludur');
  }

  // Değerleri temizle
  const cleanViolation = violation.trim();
  const cleanArticle = article.trim();
  const cleanDuration = duration.trim();
  const cleanReason = reason.trim();
  const cleanNotes = notes?.trim();

  // Tarih formatla
  const recordDate = date || new Date();
  const formattedDate = formatDateTurkish(recordDate);

  // Discord için kopyalanabilir format oluştur
  // Bu format Discord'da düzgün görünecek şekilde tasarlandı
  let copyableText = `📋 CEZA KAYDI
━━━━━━━━━━━━━━━━━━━━
📅 Tarih: ${formattedDate}
⚠️ İhlal: ${cleanViolation}
📖 Madde: ${cleanArticle}
⏱️ Süre: ${cleanDuration}
📝 Gerekçe: ${cleanReason}`;

  // Ek notlar varsa ekle
  if (cleanNotes && cleanNotes.length > 0) {
    copyableText += `\n💡 Not: ${cleanNotes}`;
  }

  copyableText += `\n━━━━━━━━━━━━━━━━━━━━`;

  return {
    violation: cleanViolation,
    article: cleanArticle,
    duration: cleanDuration,
    reason: cleanReason,
    copyableText,
  };
}

/**
 * Basit ceza kaydı oluşturur (tarih ve notlar olmadan)
 * Hızlı kullanım için kısa format
 */
export function createSimplePenaltyRecord(
  violation: string,
  article: string,
  duration: string,
  reason: string
): PenaltyRecord {
  return createPenaltyRecord({ violation, article, duration, reason });
}

/**
 * AI servisinin hazır olup olmadığını kontrol eder
 */
export function isAIServiceAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
