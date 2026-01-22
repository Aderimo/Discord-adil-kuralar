// Copy Log API - Şablon ve içerik kopyalama loglarını işler
// Requirement 12.3: WHEN a user copies a template or content THEN THE System SHALL log the copy action with content details

import { NextRequest, NextResponse } from 'next/server';
import { logTemplateCopy, logContentCopy } from '@/lib/logging';
import { getSessionFromCookie } from '@/lib/auth';

/**
 * Kopyalama log verisi yapısı
 */
interface CopyLogData {
  type: 'template' | 'content';
  // Template için
  templateId?: string;
  templateName?: string;
  templateCategory?: string;
  // Content için
  contentId?: string;
  contentTitle?: string;
  contentType?: string;
  // Ortak
  userId?: string;
}

/**
 * POST /api/logs/copy
 * Şablon veya içerik kopyalama logunu kaydeder
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const data: CopyLogData = await request.json();

    // IP adresini al
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';

    // Kullanıcı ID'sini session'dan veya request'ten al
    let userId = data.userId;
    
    if (!userId) {
      // Session'dan kullanıcı ID'sini almayı dene
      const session = await getSessionFromCookie();
      userId = session?.userId;
    }

    // Kullanıcı yoksa anonim olarak logla
    if (!userId) {
      return NextResponse.json({ 
        success: true, 
        logged: 'skipped_no_user',
        message: 'Anonim kullanıcı - log atlandı' 
      });
    }

    // Şablon kopyalama
    if (data.type === 'template') {
      if (!data.templateId || !data.templateName) {
        return NextResponse.json(
          { success: false, error: 'Template ID ve name gerekli' },
          { status: 400 }
        );
      }

      await logTemplateCopy(
        userId,
        data.templateId,
        data.templateName,
        ipAddress,
        data.templateCategory
      );

      return NextResponse.json({ 
        success: true, 
        logged: 'copy_template',
        message: `Şablon kopyalama loglandı: ${data.templateName}`
      });
    }

    // İçerik kopyalama
    if (data.type === 'content') {
      if (!data.contentId || !data.contentTitle) {
        return NextResponse.json(
          { success: false, error: 'Content ID ve title gerekli' },
          { status: 400 }
        );
      }

      await logContentCopy(
        userId,
        data.contentId,
        data.contentTitle,
        ipAddress,
        data.contentType
      );

      return NextResponse.json({ 
        success: true, 
        logged: 'copy_content',
        message: `İçerik kopyalama loglandı: ${data.contentTitle}`
      });
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz kopyalama tipi' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Copy log error:', error);
    return NextResponse.json(
      { success: false, error: 'Log kaydedilemedi' },
      { status: 500 }
    );
  }
}
