"use client";

import React from 'react';

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
    <div className="min-h-screen bg-discord-darker flex items-center justify-center">
      <h1 className="text-discord-text text-xl md:text-2xl font-medium tracking-wide text-center px-4">
        BU SİTE SADECE SANİYE MODLARINA AİTTİR
      </h1>
    </div>
  );
}
