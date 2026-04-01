// GET /api/admin/logs/export - Log export (CSV/JSON)
// Requirement 7.4: CSV ve JSON format desteği

import { NextRequest, NextResponse } from 'next/server';
import { withSuperAdmin } from '@/lib/api-auth';
import { exportLogs, type LogFilters } from '@/lib/logging';
import type { ActivityAction } from '@/types';

interface ExportResponse {
  success: boolean;
  error?: string;
}

export const GET = withSuperAdmin<string | ExportResponse>(async (request: NextRequest): Promise<NextResponse<string | ExportResponse>> => {
  try {
    // Query parametrelerini al
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') as 'csv' | 'json' | null;
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Format validasyonu
    if (!format || !['csv', 'json'].includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçersiz format. "csv" veya "json" olmalı.',
        },
        { status: 400 }
      );
    }

    // Filtre oluştur
    const filters: LogFilters = {};

    if (userId) {
      filters.userId = userId;
    }

    if (action && action !== 'all') {
      filters.action = action as ActivityAction;
    }

    if (startDateStr) {
      const startDate = new Date(startDateStr);
      if (!isNaN(startDate.getTime())) {
        filters.startDate = startDate;
      }
    }

    if (endDateStr) {
      const endDate = new Date(endDateStr);
      if (!isNaN(endDate.getTime())) {
        filters.endDate = endDate;
      }
    }

    // Logları export et
    const exportedData = await exportLogs(filters, format);

    // Dosya adı oluştur
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `logs-export-${timestamp}.${format}`;

    // Content-Type ve Content-Disposition header'larını ayarla
    const contentType = format === 'json' 
      ? 'application/json' 
      : 'text/csv; charset=utf-8';

    return new NextResponse(exportedData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Log export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Loglar export edilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
