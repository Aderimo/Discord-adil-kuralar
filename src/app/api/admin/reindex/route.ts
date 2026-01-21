/**
 * Re-indexing API Endpoint
 * Vector store'u yeniden indeksler
 *
 * Requirement 6.4: RAG tabanlı AI yanıt sistemi
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initializeVectorStore,
  resetVectorStore,
  getVectorStoreStats,
  isVectorStoreInitialized,
} from '@/lib/vector-store';
import { withAdmin } from '@/lib/api-auth';
import type { User } from '@/types';

/**
 * GET /api/admin/reindex
 * Vector store durumunu ve istatistiklerini döndürür
 */
export const GET = withAdmin(async (
  _request: NextRequest,
  _context: { params: Record<string, string>; user: User }
): Promise<NextResponse> => {
  try {
    const isInitialized = isVectorStoreInitialized();
    const stats = isInitialized ? getVectorStoreStats() : null;

    return NextResponse.json({
      success: true,
      data: {
        isInitialized,
        stats,
      },
    });
  } catch (error) {
    console.error('Vector store status error:', error);
    return NextResponse.json(
      { error: 'Vector store durumu alınamadı' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/reindex
 * Vector store'u yeniden indeksler
 *
 * Body:
 * - useMockEmbeddings?: boolean - Test için mock embedding kullan
 * - force?: boolean - Mevcut store'u sıfırla ve yeniden oluştur
 */
export const POST = withAdmin(async (
  request: NextRequest,
  _context: { params: Record<string, string>; user: User }
): Promise<NextResponse> => {
  try {
    // Request body'yi parse et
    let body: { useMockEmbeddings?: boolean; force?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Body boş olabilir, varsayılan değerler kullanılacak
    }

    const { useMockEmbeddings = false, force = false } = body;

    // Force ise mevcut store'u sıfırla
    if (force) {
      resetVectorStore();
    }

    // Vector store'u başlat
    const startTime = Date.now();
    await initializeVectorStore(useMockEmbeddings);
    const duration = Date.now() - startTime;

    // İstatistikleri al
    const stats = getVectorStoreStats();

    return NextResponse.json({
      success: true,
      message: 'Vector store başarıyla indekslendi',
      data: {
        duration: `${duration}ms`,
        stats,
        usedMockEmbeddings: useMockEmbeddings,
      },
    });
  } catch (error) {
    console.error('Re-indexing error:', error);
    return NextResponse.json(
      {
        error: 'İndeksleme sırasında hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
});
