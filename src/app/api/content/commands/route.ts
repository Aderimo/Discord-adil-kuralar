// GET /api/content/commands - Komutlar listesi
// Requirement 4.4: Prosedürleri ve komutları ayrı bölümler olarak sunmalı
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { loadCommands } from '@/lib/content';
import type { CommandDefinition } from '@/types/content';

interface CommandsResponse {
  success: boolean;
  commands?: CommandDefinition[];
  count?: number;
  error?: string;
}

export const GET = withAuth<CommandsResponse>(async () => {
  try {
    // Tüm komutları yükle
    const commands = loadCommands();

    return NextResponse.json(
      {
        success: true,
        commands,
        count: commands.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Commands fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Komutlar getirilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
