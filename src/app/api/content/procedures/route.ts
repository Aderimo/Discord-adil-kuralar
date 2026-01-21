// GET /api/content/procedures - Prosedürler listesi
// Requirement 4.4: Prosedürleri ve komutları ayrı bölümler olarak sunmalı
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { loadProcedures } from '@/lib/content';
import type { ProcedureDefinition } from '@/types/content';

interface ProceduresResponse {
  success: boolean;
  procedures?: ProcedureDefinition[];
  count?: number;
  error?: string;
}

export const GET = withAuth<ProceduresResponse>(async () => {
  try {
    // Tüm prosedürleri yükle
    const procedures = loadProcedures();

    return NextResponse.json(
      {
        success: true,
        procedures,
        count: procedures.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Procedures fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Prosedürler getirilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
