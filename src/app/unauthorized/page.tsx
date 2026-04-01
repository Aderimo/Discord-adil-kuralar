"use client";

import React from 'react';
import { ShieldX, LogIn, Home } from 'lucide-react';

/**
 * Yetkisiz Erişim Sayfası
 *
 * Reddedilen veya yetkisiz kullanıcılar için gösterilen sayfa.
 *
 * @requirement 2.1 - Yetkisiz kullanıcılara sadece bu mesaj gösterilmeli
 */
export default function UnauthorizedPage(): React.ReactElement {
  const handleLogin = (): void => {
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-discord-darker flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-discord-red/10 border-2 border-discord-red/30 flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-discord-red" />
          </div>
        </div>

        {/* Başlık */}
        <h1 className="text-2xl font-bold text-discord-text mb-3">
          Erişim Reddedildi
        </h1>

        {/* Mesaj */}
        <p className="text-discord-muted text-sm mb-2 leading-relaxed">
          Bu site yalnızca <span className="text-discord-text font-semibold">SANİYE MODLARI</span> Discord sunucusunun yetkili üyelerine açıktır.
        </p>
        <p className="text-discord-muted text-sm mb-8 leading-relaxed">
          Hesabın reddedilmiş veya henüz onaylanmamış olabilir. Sunucu yöneticisiyle iletişime geç.
        </p>

        {/* Bilgi kutusu */}
        <div className="bg-discord-light rounded-lg p-4 border border-discord-red/20 mb-6 text-left">
          <p className="text-xs text-discord-muted leading-relaxed">
            <span className="text-discord-red font-semibold block mb-1">Neden bu sayfayı görüyorum?</span>
            Hesabın onaylanmamış ya da erişim iznin bulunmuyor. Sunucuda yetkili bir üyeye başvurabilirsin.
          </p>
        </div>

        {/* Butonlar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleLogin}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-discord-accent text-white rounded-lg text-sm font-medium hover:bg-discord-accent/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Farklı Hesapla Giriş Yap
          </button>
          <a
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-discord-light text-discord-muted rounded-lg text-sm font-medium hover:bg-discord-lighter transition-colors border border-discord-lighter"
          >
            <Home className="w-4 h-4" />
            Ana Sayfa
          </a>
        </div>
      </div>
    </div>
  );
}
