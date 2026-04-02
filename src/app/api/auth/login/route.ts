// POST /api/auth/login - Kullanıcı girişi ve JWT token oluşturma
// Requirement 1.2: Geçerli kimlik bilgileriyle giriş yapıldığında oturum başlatmalı
// Requirement 1.3: Geçersiz kimlik bilgileriyle giriş reddedilmeli
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession, isValidEmail } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import type { UserRole } from '@/types';

interface LoginRequest {
  email: string;
  password: string;
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  status: string;
  role: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: UserInfo;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    // Rate limiting: IP başına 10 deneme / 15 dakika
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const rateLimit = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' },
        { status: 429 }
      );
    }

    const body = (await request.json()) as LoginRequest;
    const { email, password } = body;

    // Input validasyonu
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email ve şifre gereklidir',
        },
        { status: 400 }
      );
    }

    // Email format validasyonu - AUTH_001
    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçerli bir email adresi giriniz',
        },
        { status: 400 }
      );
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Kullanıcı bulunamadı - AUTH_004
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email veya şifre hatalı',
        },
        { status: 401 }
      );
    }

    // Şifre doğrulama - AUTH_004
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email veya şifre hatalı',
        },
        { status: 401 }
      );
    }

    // Oturum oluştur - kullanıcı bilgileriyle birlikte (RBAC middleware için)
    const session = await createSession(
      user.id, 
      user.role as UserRole,
      user.status as 'pending' | 'approved' | 'rejected'
    );

    // Son giriş zamanını güncelle
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Kullanıcı bilgilerini döndür (şifre hash'i hariç)
    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      role: user.role,
    };

    // Response oluştur
    const response = NextResponse.json(
      {
        success: true,
        token: session.token,
        user: userInfo,
      },
      { status: 200 }
    );

    // Cookie'yi server-side set et (middleware için gerekli)
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 gün
    
    response.cookies.set('auth_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expires,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Giriş işlemi sırasında bir hata oluştu',
      },
      { status: 500 }
    );
  }
}
