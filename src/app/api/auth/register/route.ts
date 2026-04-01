// POST /api/auth/register - Kullanıcı kaydı
// Requirement 1.1: Kullanıcıyı "Beklemede" durumunda veritabanına kaydetmeli
// OWNER_EMAIL: Bu email adresine sahip kullanıcı otomatik olarak owner + approved yapılır
const OWNER_EMAIL = 'esenyurtcocg65@gmail.com';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, isValidEmail, isValidPassword } from '@/lib/auth';
import { notifyAllUstYetkili } from '@/lib/notifications';

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

    // Owner email kontrolü — otomatik owner + approved
    const isOwner = email.toLowerCase() === OWNER_EMAIL.toLowerCase();

    // Kullanıcıyı oluştur
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        status: isOwner ? 'approved' : 'pending',
        role: isOwner ? 'owner' : 'none',
      },
    });

    if (isOwner) {
      return NextResponse.json(
        {
          success: true,
          message: 'Kayıt başarılı. Owner hesabınız aktif.',
          userId: user.id,
        },
        { status: 201 }
      );
    }

    // Requirement 9.2: Yeni kayıt bildirimini ust_yetkili kullanıcılara gönder
    void notifyAllUstYetkili(
      'new_user',
      'Yeni Kullanıcı Kaydı',
      `${username} (${email}) hesap oluşturdu. Onay bekliyor.`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Kayıt başarılı. Hesabınız onay bekliyor.',
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
