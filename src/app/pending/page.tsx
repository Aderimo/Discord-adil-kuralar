'use client';

/**
 * Beklemede Durumu Sayfası
 * 
 * "Beklemede" durumundaki kullanıcılar için gösterilen sayfa.
 * Hesap onay sürecini açıklar ve çıkış yapma imkanı sunar.
 * 
 * @requirement 2.3 - Beklemede durumundaki kullanıcılar ana içeriğe erişememeli
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Bekleme ikonu SVG
function ClockIcon({ className }: { className?: string }): React.ReactElement {
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
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

export default function PendingPage(): React.ReactElement {
  const router = useRouter();
  const { logout, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Çıkış hatası:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
      <Card className="w-full max-w-md bg-discord-dark border-discord-light">
        <CardHeader className="space-y-4 text-center pb-2">
          {/* Bekleme ikonu */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-discord-yellow/10 flex items-center justify-center">
              <ClockIcon className="w-10 h-10 text-discord-yellow" />
            </div>
          </div>
          
          <CardTitle className="text-xl font-bold text-discord-text">
            Hesabınız Henüz Onaylanmadı
          </CardTitle>
          
          <CardDescription className="text-discord-muted">
            SANIYE MODLARI Yetkili Kılavuzu
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <div className="p-4 rounded-lg bg-discord-lighter/50">
            <p className="text-discord-text text-sm leading-relaxed">
              Kayıt işleminiz başarıyla tamamlandı. Hesabınız şu anda{' '}
              <span className="text-discord-yellow font-medium">onay bekliyor</span>.
            </p>
          </div>

          <div className="space-y-2 text-left">
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Bir yönetici hesabınızı inceleyecek
            </p>
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Onaylandığınızda sisteme erişebileceksiniz
            </p>
            <p className="text-discord-muted text-sm">
              <span className="text-discord-accent">•</span>{' '}
              Bu süreç genellikle kısa sürer
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
            disabled={isLoading || isLoggingOut}
          >
            {isLoggingOut ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Çıkış yapılıyor...
              </span>
            ) : (
              'Çıkış Yap'
            )}
          </Button>
          
          <p className="text-xs text-discord-muted text-center">
            Sorularınız için Discord sunucusundan yöneticilere ulaşabilirsiniz.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
