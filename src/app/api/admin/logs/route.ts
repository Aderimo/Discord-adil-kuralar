// GET /api/admin/logs - Aktivite logları listesi
// Requirement 3.5: Tüm yetki değişikliklerini ve giriş işlemlerini loglamalı
// Requirement 9.1, 9.2, 9.3, 9.4: Loglama gereksinimleri

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/api-auth';
import { getActivityLogs, type LogFilters } from '@/lib/logging';
import type { ActivityAction } from '@/types';

interface LogEntryWithUser {
  id: string;
  userId: string;
  action: ActivityAction;
  details: string;
  ipAddress: string;
  timestamp: Date;
  user: {
    username: string;
    email: string;
  } | undefined;
}

interface LogsResponse {
  success: boolean;
  logs?: LogEntryWithUser[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

export const GET = withAdmin<LogsResponse>(async (request: NextRequest): Promise<NextResponse<LogsResponse>> => {
  try {
    // Query parametrelerini al
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const ipAddress = searchParams.get('ipAddress');

    // Filtre oluştur
    const filters: LogFilters = {
      page,
      pageSize,
    };

    if (action && action !== 'all') {
      filters.action = action as ActivityAction;
    }

    if (userId) {
      filters.userId = userId;
    }

    if (ipAddress) {
      filters.ipAddress = ipAddress;
    }

    if (startDateStr) {
      filters.startDate = new Date(startDateStr);
    }

    if (endDateStr) {
      filters.endDate = new Date(endDateStr);
    }

    // Logging servisini kullanarak logları getir
    const result = await getActivityLogs(filters);

    // Kullanıcı bilgilerini ekle
    const logsWithUsers = await Promise.all(
      result.logs.map(async (log) => {
        const user = await prisma.user.findUnique({
          where: { id: log.userId },
          select: {
            username: true,
            email: true,
          },
        });

        return {
          ...log,
          details: JSON.stringify(log.details), // UI için string formatına çevir
          user: user || undefined,
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        logs: logsWithUsers,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logs fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Loglar getirilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
