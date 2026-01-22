// POST /api/auth/register - Kullanıcı kaydı
// Requirement 1.1: Kullanıcıyı "Beklemede" durumunda veritabanına kaydetmeli
// Sadece onaylı kullanıcılar (saniye modları) siteye erişebilir
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, isValidEmail, isValidPassword } from '@/lib/auth';
import { notifyNewUserRegistration } from '@/lib/notifications';

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    const body = (await request.json()) as RegisterRequest;
    const { username, email, password } = body;

    // Input validasyonu
    if (!username || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Kullanıcı adı, email ve şifre gereklidir',
        },
        { status: 400 }
      );
    }

    // Email format validasyonu - AUTH_001
    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Geçerli bir email adresi giriniz',
        },
        { status: 400 }
      );
    }

    // Şifre uzunluk validasyonu - AUTH_002
    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Şifre en az 8 karakter olmalıdır',
        },
        { status: 400 }
      );
    }

    // Email zaten kayıtlı mı kontrol et - AUTH_003
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        {
          success: false,
          message: 'Bu email adresi zaten kullanılıyor',
        },
        { status: 409 }
      );
    }

    // Username zaten kayıtlı mı kontrol et
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUserByUsername) {
      return NextResponse.json(
        {
          success: false,
          message: 'Bu kullanıcı adı zaten kullanılıyor',
        },
        { status: 409 }
      );
    }

    // Şifreyi hashle
    const passwordHash = await hashPassword(password);

    // Kullanıcıyı "pending" (Beklemede) durumunda oluştur
    // Requirement 1.1: Varsayılan durum "Beklemede"
    // Yeni kullanıcılar onaylanana kadar siteye erişemez
    // roleId null olarak başlar - admin onayladıktan sonra rol atanır
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        status: 'pending', // Varsayılan "Beklemede" durumu - admin onayı gerekli
        roleId: null, // Rol atanmamış - admin onayladıktan sonra atanacak
      },
    });

    // Üst yetkililere bildirim gönder
    try {
      await notifyNewUserRegistration({
        id: user.id,
        username: user.username,
        email: user.email,
      });
    } catch (notificationError) {
      // Bildirim hatası kritik değil, log'la ve devam et
      console.error('Notification error:', notificationError);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Kayıt başarılı. Hesabınız yetkili onayı bekliyor.',
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Kayıt işlemi sırasında bir hata oluştu',
      },
      { status: 500 }
    );
  }
}
