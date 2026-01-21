'use client';

/**
 * 404 - Sayfa Bulunamadı
 * 
 * Var olmayan sayfalara erişildiğinde gösterilen hata sayfası.
 * Discord dark theme stilinde tasarlanmıştır.
 * 
 * @requirement Hata yönetimi - 404 sayfası
 */

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// 404 ikonu SVG
function NotFoundIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
      />
    </svg>
  );
}

export default function NotFound(): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
      <Card className="w-full max-w-md bg-discord-dark border-discord-light">
        <CardHeader className="space-y-4 text-center pb-2">
          {/* 404 ikonu */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-discord-red/10 flex items-center justify-center">
              <NotFoundIcon className="w-10 h-10 text-discord-red" />
            </div>
          </div>
          
          <CardTitle className="text-xl font-bold text-discord-text">
            Sayfa Bulunamadı
          </CardTitle>
          
          <CardDescription className="text-discord-muted">
            Hata Kodu: 404
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <div className="p-4 rounded-lg bg-discord-lighter/50">
            <p className="text-discord-text text-sm leading-relaxed">
              Aradığınız sayfa{' '}
              <span className="text-discord-red font-medium">bulunamadı</span>.
              Sayfa taşınmış, silinmiş veya hiç var olmamış olabilir.
            </p>
          </div>

          <div className="space-y-2 text-left">
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              URL adresini kontrol edin
            </p>
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Ana sayfaya dönmeyi deneyin
            </p>
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Sorun devam ederse yöneticiye bildirin
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-2">
          <Link href="/" className="w-full">
            <Button className="w-full bg-discord-accent hover:bg-discord-accent/90">
              Ana Sayfaya Dön
            </Button>
          </Link>
          
          <p className="text-xs text-discord-muted text-center">
            SANIYE MODLARI Yetkili Kılavuzu
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
