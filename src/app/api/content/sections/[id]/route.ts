// GET /api/content/sections/:id - Tek bölüm detayı
// PUT /api/content/sections/:id - İçerik güncelleme (sadece ust_yetkili)
// DELETE /api/content/sections/:id - İçerik silme (sadece ust_yetkili)
// Requirement 4.2: Bir yetkili bir bölümü seçer, sistem ilgili içeriği göstermeli
// Requirement 11.1: Üst yetkili içerik sayfasına erişir, düzenleme butonunu göstermeli
// Requirement 11.3: Üst yetkili değişiklikleri kaydeder, içeriği güncellemeli ve log oluşturmalı
// Requirement 11.5: Sadece ust_yetkili rolü içerik düzenleyebilir
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withSuperAdmin } from '@/lib/api-auth';
import { loadGuideContent, getGuideBySlug, loadPenalties, loadCommands, loadProcedures, clearContentCache } from '@/lib/content';
import { logContentChange } from '@/lib/logging';
import type { GuideContent } from '@/types/content';
import fs from 'fs';
import path from 'path';

interface SectionDetailResponse {
  success: boolean;
  section?: GuideContent;
  error?: string;
}

interface UpdateContentRequest {
  title?: string;
  content?: string;
  keywords?: string[];
  // Diğer alanlar için genel destek
  [key: string]: unknown;
}

interface UpdateContentResponse {
  success: boolean;
  updatedAt?: Date;
  error?: string;
}

interface DeleteContentResponse {
  success: boolean;
  deletedAt?: Date;
  error?: string;
}

export const GET = withAuth<SectionDetailResponse>(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = params;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Bölüm ID gerekli',
          },
          { status: 400 }
        );
      }

      // Önce ID ile ara
      const sections = loadGuideContent();
      let section = sections.find((s) => s.id === id);

      // ID ile bulunamazsa slug ile dene
      if (!section) {
        section = getGuideBySlug(id) || undefined;
      }

      if (!section) {
        return NextResponse.json(
          {
            success: false,
            error: 'Bölüm bulunamadı',
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          section,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('Section detail fetch error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Bölüm detayı getirilirken bir hata oluştu',
        },
        { status: 500 }
      );
    }
  }
);

// PUT /api/content/sections/:id - İçerik güncelleme
// Requirement 11.1, 11.3, 11.5: Sadece ust_yetkili içerik düzenleyebilir
export const PUT = withSuperAdmin<UpdateContentResponse>(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = params;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Bölüm ID gerekli',
          },
          { status: 400 }
        );
      }

      const body = await request.json() as UpdateContentRequest;

      // Güncellenecek alan var mı kontrol et
      if (Object.keys(body).length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Güncellenecek alan belirtilmedi',
          },
          { status: 400 }
        );
      }

      // İçeriği bul ve tipini belirle
      let contentType: 'guide' | 'penalty' | 'command' | 'procedure' | null = null;
      let filePath: string = '';
      let itemIndex: number = -1;
      let existingItem: unknown = null;

      // Kılavuz içeriğinde ara
      const guides = loadGuideContent();
      itemIndex = guides.findIndex((g) => g.id === id);
      if (itemIndex !== -1) {
        contentType = 'guide';
        filePath = path.join(process.cwd(), 'content', 'guide', 'index.json');
        existingItem = guides[itemIndex];
      }

      // Cezalarda ara
      if (!contentType) {
        const penalties = loadPenalties();
        itemIndex = penalties.findIndex((p) => p.id === id);
        if (itemIndex !== -1) {
          contentType = 'penalty';
          filePath = path.join(process.cwd(), 'content', 'penalties', 'index.json');
          existingItem = penalties[itemIndex];
        }
      }

      // Komutlarda ara
      if (!contentType) {
        const commands = loadCommands();
        itemIndex = commands.findIndex((c) => c.id === id);
        if (itemIndex !== -1) {
          contentType = 'command';
          filePath = path.join(process.cwd(), 'content', 'commands', 'index.json');
          existingItem = commands[itemIndex];
        }
      }

      // Prosedürlerde ara
      if (!contentType) {
        const procedures = loadProcedures();
        itemIndex = procedures.findIndex((p) => p.id === id);
        if (itemIndex !== -1) {
          contentType = 'procedure';
          filePath = path.join(process.cwd(), 'content', 'procedures', 'index.json');
          existingItem = procedures[itemIndex];
        }
      }

      if (!contentType || !existingItem) {
        return NextResponse.json(
          {
            success: false,
            error: 'İçerik bulunamadı',
          },
          { status: 404 }
        );
      }

      // Mevcut dosyayı oku
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const indexData = JSON.parse(fileContent) as { items: unknown[]; lastUpdated: string; version: string };

      // Dosyadaki item'ı bul
      const fileItemIndex = indexData.items.findIndex((item: unknown) => (item as { id: string }).id === id);
      if (fileItemIndex === -1) {
        return NextResponse.json(
          {
            success: false,
            error: 'İçerik dosyada bulunamadı',
          },
          { status: 404 }
        );
      }

      // Önceki içeriği sakla (loglama için)
      const previousContent = { ...indexData.items[fileItemIndex] as Record<string, unknown> };

      // İçeriği güncelle
      const updatedItem = { ...indexData.items[fileItemIndex] as Record<string, unknown>, ...body };
      indexData.items[fileItemIndex] = updatedItem;
      indexData.lastUpdated = new Date().toISOString();

      // Dosyaya yaz
      fs.writeFileSync(filePath, JSON.stringify(indexData, null, 2), 'utf-8');

      // Cache'i temizle
      clearContentCache();

      // IP adresini al
      const ipAddress = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        '127.0.0.1';

      // İçerik değişikliğini logla
      // Requirement 11.6: Tüm içerik değişikliklerini loglamalı
      const contentTitle = 'title' in updatedItem ? (updatedItem as { title: string }).title : 
                          'name' in updatedItem ? (updatedItem as { name: string }).name :
                          'command' in updatedItem ? (updatedItem as { command: string }).command : id;
      
      await logContentChange(
        user.id,
        id,
        'update',
        ipAddress,
        contentType,
        contentTitle,
        previousContent,
        updatedItem as Record<string, unknown>
      );

      return NextResponse.json(
        {
          success: true,
          updatedAt: new Date(),
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('Content update error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'İçerik güncellenirken bir hata oluştu',
        },
        { status: 500 }
      );
    }
  }
);

// DELETE /api/content/sections/:id - İçerik silme
// Requirement 11.5: Sadece ust_yetkili rolü içerik düzenleyebilir
export const DELETE = withSuperAdmin<DeleteContentResponse>(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = params;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Bölüm ID gerekli',
          },
          { status: 400 }
        );
      }

      // İçeriği bul ve tipini belirle
      let contentType: 'guide' | 'penalty' | 'command' | 'procedure' | null = null;
      let filePath: string = '';
      let existingItem: unknown = null;

      // Kılavuz içeriğinde ara
      const guides = loadGuideContent();
      let itemIndex = guides.findIndex((g) => g.id === id);
      if (itemIndex !== -1) {
        contentType = 'guide';
        filePath = path.join(process.cwd(), 'content', 'guide', 'index.json');
        existingItem = guides[itemIndex];
      }

      // Cezalarda ara
      if (!contentType) {
        const penalties = loadPenalties();
        itemIndex = penalties.findIndex((p) => p.id === id);
        if (itemIndex !== -1) {
          contentType = 'penalty';
          filePath = path.join(process.cwd(), 'content', 'penalties', 'index.json');
          existingItem = penalties[itemIndex];
        }
      }

      // Komutlarda ara
      if (!contentType) {
        const commands = loadCommands();
        itemIndex = commands.findIndex((c) => c.id === id);
        if (itemIndex !== -1) {
          contentType = 'command';
          filePath = path.join(process.cwd(), 'content', 'commands', 'index.json');
          existingItem = commands[itemIndex];
        }
      }

      // Prosedürlerde ara
      if (!contentType) {
        const procedures = loadProcedures();
        itemIndex = procedures.findIndex((p) => p.id === id);
        if (itemIndex !== -1) {
          contentType = 'procedure';
          filePath = path.join(process.cwd(), 'content', 'procedures', 'index.json');
          existingItem = procedures[itemIndex];
        }
      }

      if (!contentType || !existingItem) {
        return NextResponse.json(
          {
            success: false,
            error: 'İçerik bulunamadı',
          },
          { status: 404 }
        );
      }

      // Mevcut dosyayı oku
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const indexData = JSON.parse(fileContent) as { items: unknown[]; lastUpdated: string; version: string };

      // Dosyadaki item'ı bul
      const fileItemIndex = indexData.items.findIndex((item: unknown) => (item as { id: string }).id === id);
      if (fileItemIndex === -1) {
        return NextResponse.json(
          {
            success: false,
            error: 'İçerik dosyada bulunamadı',
          },
          { status: 404 }
        );
      }

      // Silinen içeriği sakla (loglama için)
      const deletedContent = { ...indexData.items[fileItemIndex] as Record<string, unknown> };

      // İçeriği sil
      indexData.items.splice(fileItemIndex, 1);
      indexData.lastUpdated = new Date().toISOString();

      // Dosyaya yaz
      fs.writeFileSync(filePath, JSON.stringify(indexData, null, 2), 'utf-8');

      // Cache'i temizle
      clearContentCache();

      // IP adresini al
      const ipAddress = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        '127.0.0.1';

      // İçerik değişikliğini logla
      // Requirement 11.6: Tüm içerik değişikliklerini loglamalı
      const contentTitle = 'title' in deletedContent ? (deletedContent as { title: string }).title : 
                          'name' in deletedContent ? (deletedContent as { name: string }).name :
                          'command' in deletedContent ? (deletedContent as { command: string }).command : id;
      
      await logContentChange(
        user.id,
        id,
        'delete',
        ipAddress,
        contentType,
        contentTitle,
        deletedContent,
        undefined
      );

      return NextResponse.json(
        {
          success: true,
          deletedAt: new Date(),
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('Content delete error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'İçerik silinirken bir hata oluştu',
        },
        { status: 500 }
      );
    }
  }
);
