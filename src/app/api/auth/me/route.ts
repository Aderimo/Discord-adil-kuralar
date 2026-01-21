// GET /api/auth/me - Mevcut kullanıcı bilgisi
// Requirement 1.2: Kullanıcının yetki durumunu kontrol etmeli
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';

interface UserInfo {
  id: string;
  username: string;
  email: string;
  status: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null | undefined;
}

interface MeResponse {
  success: boolean;
  user?: UserInfo;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<MeResponse>> {
  try {
    // Authorization header'dan token al
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Yetkilendirme token\'ı gereklidir',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // "Bearer " kısmını çıkar

    // Token ile kullanıcı bilgisini al
    const user = await getUserFromToken(token);
    
    if (!user) {
      // AUTH_005: Oturum süresi dolmuş
      return NextResponse.json(
        {
          success: false,
          error: 'Oturumunuz sona erdi, lütfen tekrar giriş yapın',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          status: user.status,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Me endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Kullanıcı bilgisi alınırken bir hata oluştu',
      },
      { status: 500 }
    );
  }
}
