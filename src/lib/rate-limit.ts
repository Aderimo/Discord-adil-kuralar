// Basit in-memory rate limiter - auth endpointleri için
// Serverless ortamda her instance bağımsız çalışır, bu yüzden hafif bir çözüm

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Eski kayıtları temizle (bellek sızıntısını önle)
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

/**
 * Rate limit kontrolü
 * @param key - IP adresi veya benzeri tanımlayıcı
 * @param limit - İzin verilen maksimum istek sayısı
 * @param windowMs - Zaman penceresi (milisaniye)
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  // Periyodik temizlik
  if (Math.random() < 0.01) {
    cleanup();
  }

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Yeni pencere başlat
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
