'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

function ResetPasswordContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrors({ general: 'Geçersiz veya eksik sıfırlama bağlantısı.' });
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErrors({});

    // Validasyon
    const newErrors: typeof errors = {};

    if (!password) {
      newErrors.password = 'Şifre gereklidir';
    } else if (!isValidPassword(password)) {
      newErrors.password = 'Şifre en az 8 karakter olmalıdır';
    }

    if (!confirmPassword) {
      newErrors.confirm = 'Şifre tekrarı gereklidir';
    } else if (password !== confirmPassword) {
      newErrors.confirm = 'Şifreler eşleşmiyor';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: 'Şifre Değiştirildi',
          description: 'Yeni şifrenizle giriş yapabilirsiniz.',
          variant: 'success',
        });
      } else {
        setErrors({ general: data.error || 'Bir hata oluştu' });
      }
    } catch {
      setErrors({ general: 'Bir hata oluştu. Lütfen tekrar deneyin.' });
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
              Şifre Değiştirildi
            </CardTitle>
            <CardDescription className="text-discord-muted">
              Yeni şifreniz başarıyla kaydedildi.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href={'/login' as Route} className="w-full">
              <Button className="w-full">Giriş Yap</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
        <Card className="w-full max-w-md bg-discord-dark border-discord-light">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-discord-red/20 rounded-full flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-discord-red">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold text-discord-text">
              Geçersiz Bağlantı
            </CardTitle>
            <CardDescription className="text-discord-muted">
              Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href={'/forgot-password' as Route} className="w-full">
              <Button variant="outline" className="w-full">
                Yeni Bağlantı İste
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
            Yeni Şifre Belirle
          </CardTitle>
          <CardDescription className="text-discord-muted">
            Hesabınız için yeni bir şifre oluşturun.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errors.general && (
              <div className="p-3 rounded-md bg-discord-red/10 border border-discord-red/30">
                <p className="text-sm text-discord-red">{errors.general}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-discord-text">Yeni Şifre</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors({ ...errors, password: '' });
                    }
                  }}
                  disabled={isSubmitting}
                  className={`pr-10 ${errors.password ? 'border-discord-red' : ''}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-discord-muted hover:text-discord-text"
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="text-sm text-discord-red">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-discord-text">Şifre Tekrar</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirm) {
                    setErrors({ ...errors, confirm: '' });
                  }
                }}
                disabled={isSubmitting}
                className={errors.confirm ? 'border-discord-red' : ''}
                autoComplete="new-password"
              />
              {errors.confirm && <p className="text-sm text-discord-red">{errors.confirm}</p>}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Kaydediliyor...' : 'Şifreyi Değiştir'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-discord-darker">
        <div className="animate-spin h-8 w-8 border-2 border-discord-accent border-t-transparent rounded-full" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
