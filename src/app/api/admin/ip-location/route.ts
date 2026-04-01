import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api-auth';

// ip-api.com free plan sadece HTTP destekler.
// Browser'dan HTTPS ile çağrıldığında 403 verir.
// Bu route, server-side'da HTTP ile ip-api.com'a bağlanır.
export const GET = withRole('ust_yetkili', async (request: NextRequest) => {
  const ip = request.nextUrl.searchParams.get('ip');

  if (!ip) {
    return NextResponse.json({ error: 'ip parametresi eksik' }, { status: 400 });
  }

  // Loopback ve private IP'leri filtrele
  if (
    ip === '::1' ||
    ip === 'unknown' ||
    ip.startsWith('127.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return NextResponse.json({ status: 'fail' }, { status: 200 });
  }

  try {
    // Server-side HTTP isteği - ip-api.com free plan ile uyumlu
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,city,status&lang=tr`,
      { next: { revalidate: 3600 } } // 1 saat cache
    );

    if (!res.ok) {
      return NextResponse.json({ status: 'fail' }, { status: 200 });
    }

    const data = await res.json() as { status: string; country?: string; city?: string };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'fail' }, { status: 200 });
  }
});
