"use client";

import React from 'react';
import { Shield } from 'lucide-react';

/**
 * Yetkisiz Erişim Sayfası
 * 
 * Onaylanmamış veya yetkisiz kullanıcılar için gösterilen sayfa.
 * Sadece "BU SİTE SADECE SANİYE MODLARINA AİTTİR" mesajını gösterir.
 * 
 * @requirement 2.1 - Yetkisiz kullanıcılara sadece bu mesaj gösterilmeli
 */
export default function UnauthorizedPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-discord-darker flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-discord-red/20 flex items-center justify-center">
          <Shield className="w-10 h-10 text-discord-red" />
        </div>
        
        <h1 className="text-discord-text text-xl md:text-2xl font-medium tracking-wide">
          BU SİTE SADECE SANİYE MODLARINA AİTTİR
        </h1>
        
        <p className="text-discord-muted text-sm">
          Bu sayfaya erişim yetkiniz bulunmamaktadır.
        </p>

        <div className="mt-4 p-4 rounded-lg bg-discord-dark border border-discord-light">
          <p className="text-sm text-discord-muted">
            Yetkili olmak istiyorsanız veya bir hata olduğunu düşünüyorsanız,{' '}
            <a
              href="https://discord.gg/KVMmAJvVPr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-discord-accent hover:underline font-medium"
            >
              Saniye Discord sunucusuna
            </a>
            {' '}katılarak modlarla görüşebilirsiniz.
          </p>
        </div>

        <a
          href="/login"
          className="mt-2 px-6 py-2 bg-discord-accent text-white rounded-lg font-medium hover:bg-discord-accent/90 transition-colors"
        >
          Giriş Sayfasına Dön
        </a>
      </div>
    </div>
  );
}
