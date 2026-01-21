// GET /api/content/sections - Tüm bölümler listesi
// POST /api/content/sections - Yeni içerik ekleme (sadece ust_yetkili)
// Requirement 4.1: Yetkili Kılavuzu içeriğini bölümlere ayrılmış şekilde sunmalı
// Requirement 11.4: Yeni bölüm/ceza/komut ekleme formu sunmalı
// Requirement 11.5: Sadece ust_yetkili rolü içerik düzenleyebilir
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withSuperAdmin } from '@/lib/api-auth';
import { loadGuideContent, loadPenalties, loadCommands, loadProcedures } from '@/lib/content';
import { logContentChange } from '@/lib/logging';
import type { GuideContent, PenaltyDefinition, CommandDefinition, ProcedureDefinition } from '@/types/content';
import fs from 'fs';
import path from 'path';

interface SectionsResponse {
  success: boolean;
  sections?: GuideContent[];
  count?: number;
  error?: string;
}

interface CreateContentRequest {
  type: 'guide' | 'penalty' | 'command' | 'procedure';
  data: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition;
}

interface CreateContentResponse {
  success: boolean;
  id?: string;
  createdAt?: Date;
  error?: string;
}

export const GET = withAuth<SectionsResponse>(async () => {
  try {
    // Tüm kılavuz bölümlerini yükle
    const sections = loadGuideContent();

    return NextResponse.json(
      {
        success: true,
        sections,
        count: sections.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Sections fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Bölümler getirilirken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});

// POST /api/content/sections - Yeni içerik ekleme
// Requirement 11.4: Yeni bölüm/ceza/komut ekleme formu sunmalı
// Requirement 11.5: Sadece ust_yetkili rolü içerik düzenleyebilir
export const POST = withSuperAdmin<CreateContentResponse>(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json() as CreateContentRequest;
    const { type, data } = body;

    // Validasyon
    if (!type || !data) {
      return NextResponse.json(
        {
          success: false,
          error: 'İçerik tipi ve verisi gerekli',
        },
        { status: 400 }
      );
    }

    // Geçerli tip kontrolü
    const validTypes = ['guide', 'penalty', 'command', 'procedure'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçersiz içerik tipi. Geçerli tipler: guide, penalty, command, procedure',
        },
        { status: 400 }
      );
    }

    // ID kontrolü
    if (!data.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'İçerik ID gerekli',
        },
        { status: 400 }
      );
    }

    // İçerik dosyası yolunu belirle
    let filePath: string = '';
    let existingItems: Array<{ id: string }> = [];
    let indexData: { items: unknown[]; lastUpdated: string; version: string } = { items: [], lastUpdated: '', version: '' };

    switch (type) {
      case 'guide':
        filePath = path.join(process.cwd(), 'content', 'guide', 'index.json');
        existingItems = loadGuideContent();
        break;
      case 'penalty':
        filePath = path.join(process.cwd(), 'content', 'penalties', 'index.json');
        existingItems = loadPenalties();
        break;
      case 'command':
        filePath = path.join(process.cwd(), 'content', 'commands', 'index.json');
        existingItems = loadCommands();
        break;
      case 'procedure':
        filePath = path.join(process.cwd(), 'content', 'procedures', 'index.json');
        existingItems = loadProcedures();
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Geçersiz içerik tipi',
          },
          { status: 400 }
        );
    }

    // ID çakışması kontrolü
    const existingItem = existingItems.find((item) => item.id === data.id);
    if (existingItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bu ID ile bir içerik zaten mevcut',
        },
        { status: 409 }
      );
    }

    // Mevcut dosyayı oku
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    indexData = JSON.parse(fileContent);

    // Yeni içeriği ekle
    indexData.items.push(data);
    indexData.lastUpdated = new Date().toISOString();

    // Dosyaya yaz
    fs.writeFileSync(filePath, JSON.stringify(indexData, null, 2), 'utf-8');

    // IP adresini al
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';

    // İçerik değişikliğini logla
    // Requirement 11.6: Tüm içerik değişikliklerini loglamalı
    const dataId = data.id;
    const contentTitle = 'title' in data ? (data as GuideContent | ProcedureDefinition).title : 
                        'name' in data ? (data as PenaltyDefinition).name :
                        'command' in data ? (data as CommandDefinition).command : dataId;
    
    await logContentChange(
      user.id,
      dataId,
      'create',
      ipAddress,
      type,
      contentTitle,
      undefined,
      data as unknown as Record<string, unknown>
    );

    return NextResponse.json(
      {
        success: true,
        id: data.id,
        createdAt: new Date(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Content create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'İçerik oluşturulurken bir hata oluştu',
      },
      { status: 500 }
    );
  }
});
