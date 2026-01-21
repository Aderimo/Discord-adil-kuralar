import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, isValidPassword } from '@/lib/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token, password } = body;

    // Token kontrolü
    if (!token) {
      return NextResponse.json(
        { error: 'Geçersiz sıfırlama bağlantısı' },
        { status: 400 }
      );
    }

    // Şifre validasyonu
    if (!password || !isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Şifre en az 8 karakter olmalıdır' },
        { status: 400 }
      );
    }

    // Token ile kullanıcıyı bul
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(), // Token süresi dolmamış olmalı
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Geçersiz veya süresi dolmuş sıfırlama bağlantısı' },
        { status: 400 }
      );
    }

    // Yeni şifreyi hashle
    const passwordHash = await hashPassword(password);

    // Kullanıcıyı güncelle
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Mevcut oturumları sil (güvenlik için)
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Şifreniz başarıyla değiştirildi.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
