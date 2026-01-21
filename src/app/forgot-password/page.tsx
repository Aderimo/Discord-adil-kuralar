'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function ForgotPasswordPage(): React.ReactElement {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(undefined);

    if (!email.trim()) {
      setError('Email adresi gereklidir');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Geçerli bir email adresi giriniz');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: 'Email Gönderildi',
          description: 'Şifre sıfırlama bağlantısı email adresinize gönderildi.',
          variant: 'success',
        });
      } else {
        setError(data.error || 'Bir hata oluştu');
      }
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
        <Card className="w-full max-w-md bg-discord-dark border-discord-light">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-discord-green/20 rounded-full flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-discord-green">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold text-discord-text">
              Email Gönderildi
            </CardTitle>
            <CardDescription className="text-discord-muted">
              Şifre sıfırlama bağlantısı <span className="text-discord-accent">{email}</span> adresine gönderildi.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-discord-muted text-sm">
            <p>Email gelmezse spam klasörünü kontrol edin.</p>
          </CardContent>
          <CardFooter>
            <Link href={'/login' as Route} className="w-full">
              <Button variant="outline" className="w-full">
                Giriş Sayfasına Dön
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
      <Card className="w-full max-w-md bg-discord-dark border-discord-light">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-discord-text">
            Şifremi Unuttum
          </CardTitle>
          <CardDescription className="text-discord-muted">
            Email adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-discord-red/10 border border-discord-red/30">
                <p className="text-sm text-discord-red">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-discord-text">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) {
                    setError(undefined);
                  }
                }}
                disabled={isSubmitting}
                className={error ? 'border-discord-red focus-visible:ring-discord-red' : ''}
                autoComplete="email"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Gönderiliyor...
                </span>
              ) : (
                'Sıfırlama Bağlantısı Gönder'
              )}
            </Button>

            <Link
              href={'/login' as Route}
              className="text-sm text-discord-muted hover:text-discord-accent transition-colors"
            >
              ← Giriş sayfasına dön
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
