'use client';

/**
 * 500 - Sunucu Hatası / Genel Hata Sayfası
 * 
 * Uygulama içinde oluşan hataları yakalayan error boundary.
 * Discord dark theme stilinde tasarlanmıştır.
 * 
 * @requirement Hata yönetimi - 500 sayfası ve hata boundary
 */

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Hata ikonu SVG
function ErrorIcon({ className }: { className?: string }): React.ReactElement {
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
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps): React.ReactElement {
  useEffect(() => {
    // Hatayı konsola logla (production'da error tracking servisine gönderilebilir)
    console.error('Uygulama hatası:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
      <Card className="w-full max-w-md bg-discord-dark border-discord-light">
        <CardHeader className="space-y-4 text-center pb-2">
          {/* Hata ikonu */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-discord-red/10 flex items-center justify-center">
              <ErrorIcon className="w-10 h-10 text-discord-red" />
            </div>
          </div>
          
          <CardTitle className="text-xl font-bold text-discord-text">
            Bir Hata Oluştu
          </CardTitle>
          
          <CardDescription className="text-discord-muted">
            Hata Kodu: 500
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <div className="p-4 rounded-lg bg-discord-lighter/50">
            <p className="text-discord-text text-sm leading-relaxed">
              Beklenmeyen bir{' '}
              <span className="text-discord-red font-medium">hata</span>{' '}
              oluştu. Lütfen tekrar deneyin veya daha sonra geri dönün.
            </p>
          </div>

          {error.digest && (
            <div className="p-3 rounded-lg bg-discord-darker border border-discord-light">
              <p className="text-discord-muted text-xs font-mono">
                Hata ID: {error.digest}
              </p>
            </div>
          )}

          <div className="space-y-2 text-left">
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Sayfayı yenilemeyi deneyin
            </p>
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Tarayıcı önbelleğini temizleyin
            </p>
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Sorun devam ederse yöneticiye bildirin
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-2">
          <Button
            onClick={reset}
            className="w-full bg-discord-accent hover:bg-discord-accent/90"
          >
            Tekrar Dene
          </Button>
          
          <p className="text-xs text-discord-muted text-center">
            SANIYE MODLARI Yetkili Kılavuzu
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
