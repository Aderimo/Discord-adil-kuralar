// GET /api/content/penalties - Cezalar listesi
// Requirement 4.3: Cezaları kategorilere ayırmalı (yazılı, sesli, ekstra, marked, blacklist)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { loadPenalties, loadPenaltiesByCategory } from '@/lib/content';
import type { PenaltyDefinition, PenaltyCategory } from '@/types/content';

interface PenaltiesResponse {
  success: boolean;
  penalties?: PenaltyDefinition[];
  count?: number;
  category?: PenaltyCategory;
  error?: string;
}

const validCategories: PenaltyCategory[] = ['yazili', 'sesli', 'ekstra', 'marked', 'blacklist'];

export const GET = withAuth<PenaltiesResponse>(async (request: NextRequest) => {
  try {
    // URL'den kategori parametresini al
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as PenaltyCategory | null;

    let penalties: PenaltyDefinition[];

    // Kategori belirtilmişse filtrele
    if (category) {
      // Geçerli kategori kontrolü
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          {
            success: false,
            error: `Geçersiz kategori. Geçerli kategoriler: ${validCategories.join(', ')}`,
          },
          { status: 400 }
        );
      }

      penalties = loadPenaltiesByCategory(category);

      return NextResponse.json(
        {
          success: true,
          penalties,
          count: penalties.length,
          category,
        },
        { status: 200 }
      );
    }

    // Tüm cezaları getir
    penalties = loadPenalties();

    return NextResponse.json(
      {
        success: true,
        penalties,
        count: penalties.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Penalties fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cezalar getirilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
