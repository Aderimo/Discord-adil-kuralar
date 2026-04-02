import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidEmail } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

// Şifre sıfırlama token'ı oluştur
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting: IP başına 3 deneme / 1 saat
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const rateLimit = checkRateLimit(`forgot:${ip}`, 3, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Çok fazla deneme. 1 saat sonra tekrar deneyin.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    // Email validasyonu
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Geçerli bir email adresi giriniz' },
        { status: 400 }
      );
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Güvenlik: Kullanıcı bulunamasa bile başarılı mesajı göster
    // Bu, email enumeration saldırılarını önler
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Eğer bu email adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.',
      });
    }

    // Reset token oluştur
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 saat geçerli

    // Token'ı veritabanına kaydet
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // NOT: Gerçek uygulamada burada email gönderimi yapılır
    // Development modunda resetUrl döndürülür
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('=== ŞİFRE SIFIRLAMA ===');
      // eslint-disable-next-line no-console
      console.log(`Email: ${email}`);
      // eslint-disable-next-line no-console
      console.log(`Reset URL: ${resetUrl}`);
      // eslint-disable-next-line no-console
      console.log('========================');
    }

    return NextResponse.json({
      success: true,
      message: 'Şifre sıfırlama bağlantısı email adresinize gönderildi.',
      // Development modunda token'ı da döndür (test için)
      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
