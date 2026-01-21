// POST /api/auth/logout - Oturum sonlandırma
// Requirement 1.4: Çıkış yapıldığında oturum sonlandırılmalı
import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, validateSession } from '@/lib/auth';

interface LogoutResponse {
  success: boolean;
  message: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<LogoutResponse>> {
  try {
    // Authorization header'dan token al
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Yetkilendirme token\'ı gereklidir',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // "Bearer " kısmını çıkar

    // Token geçerli mi kontrol et
    const session = await validateSession(token);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: 'Geçersiz veya süresi dolmuş oturum',
        },
        { status: 401 }
      );
    }

    // Oturumu sil
    await deleteSession(token);

    // Response oluştur
    const response = NextResponse.json(
      {
        success: true,
        message: 'Çıkış başarılı',
      },
      { status: 200 }
    );

    // Cookie'yi sil
    response.cookies.set('auth_token', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0), // Geçmiş tarih = cookie silinir
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Çıkış işlemi sırasında bir hata oluştu',
      },
      { status: 500 }
    );
  }
}
