/**
 * Search API Endpoint
 * GET /api/search?q={query}&type={type}
 * 
 * Tam metin arama ve filtreleme
 * Requirements: 5.1, 5.2, 5.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { searchContent, searchByCommonTerm } from '@/lib/content';
import type { SearchResult, SearchResultType } from '@/types/content';

/**
 * Href eklenmiş arama sonucu
 */
interface SearchResultWithHref extends SearchResult {
  href: string;
}

/**
 * Arama yanıt tipi
 */
interface SearchResponse {
  success: boolean;
  results?: SearchResultWithHref[];
  totalCount?: number;
  query?: string;
  type?: string;
  error?: string;
}

/**
 * İçerik tipine göre href oluşturur
 */
function generateHref(result: SearchResult): string {
  switch (result.type) {
    case 'madde':
      return `/guide/${result.id}`;
    case 'ceza':
      return `/penalties/${result.id}`;
    case 'komut':
      return `/commands/${result.id}`;
    case 'prosedur':
      return `/procedures/${result.id}`;
    default:
      return `/${result.type}/${result.id}`;
  }
}

/**
 * Content type'ı SearchResultType'a dönüştürür
 * API'de guide, penalty, command, procedure kullanılabilir
 */
function normalizeContentType(type: string): SearchResultType | null {
  const typeMap: Record<string, SearchResultType> = {
    guide: 'madde',
    madde: 'madde',
    penalty: 'ceza',
    ceza: 'ceza',
    command: 'komut',
    komut: 'komut',
    procedure: 'prosedur',
    prosedur: 'prosedur',
  };
  
  return typeMap[type.toLowerCase()] || null;
}

/**
 * GET /api/search
 * 
 * Query parametreleri:
 * - q: Arama terimi (zorunlu)
 * - type: İçerik tipi filtresi (opsiyonel: guide, penalty, command, procedure)
 * 
 * Requirement 5.1: Madde, ceza, komut ve ihlal bazlı sonuçları göstermeli
 * Requirement 5.2: Sonuçları kategori ve ilgililik sırasına göre listelemeli
 * Requirement 5.3: Yaygın terimleri tanımalı
 */
export const GET = withAuth<SearchResponse>(async (request: NextRequest): Promise<NextResponse<SearchResponse>> => {
  try {
    // Query parametrelerini al
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const typeFilter = searchParams.get('type');

    // Boş sorgu kontrolü
    if (!query || query.trim().length === 0) {
      const response: SearchResponse = {
        success: true,
        results: [],
        totalCount: 0,
        query: '',
      };
      return NextResponse.json(response, { status: 200 });
    }

    const trimmedQuery = query.trim();

    // Önce yaygın terimlerle ara, sonra genel arama yap
    let results = searchByCommonTerm(trimmedQuery);
    
    // Yaygın terim bulunamadıysa genel arama yap
    if (results.length === 0) {
      results = searchContent(trimmedQuery);
    }

    // Tip filtresi uygula
    if (typeFilter) {
      const normalizedType = normalizeContentType(typeFilter);
      
      if (normalizedType) {
        results = results.filter((r) => r.type === normalizedType);
      }
    }

    // Href ekle ve sonuçları dönüştür
    const resultsWithHref: SearchResultWithHref[] = results.map((result) => ({
      ...result,
      href: generateHref(result),
    }));

    const response: SearchResponse = {
      success: true,
      results: resultsWithHref,
      totalCount: resultsWithHref.length,
      query: trimmedQuery,
    };
    
    if (typeFilter) {
      response.type = typeFilter;
    }
    
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Search error:', error);
    const response: SearchResponse = {
      success: false,
      error: 'Arama sırasında bir hata oluştu',
    };
    return NextResponse.json(response, { status: 500 });
  }
});
