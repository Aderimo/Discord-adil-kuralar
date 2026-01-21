'use client';

// Login Sayfası
// Requirement 1.2: Kullanıcı geçerli kimlik bilgileriyle giriş yapar
// Requirement 1.3: Geçersiz kimlik bilgileriyle giriş denemesi hata mesajı gösterir

import React, { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Hata kodları - design.md'den
const ERROR_MESSAGES = {
  AUTH_001: 'Geçerli bir email adresi giriniz',
  AUTH_002: 'Şifre en az 8 karakter olmalıdır',
  AUTH_004: 'Email veya şifre hatalı',
};

// Email validasyonu
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Şifre validasyonu
function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

interface FormErrors {
  email: string | undefined;
  password: string | undefined;
  general: string | undefined;
}

export default function LoginPage(): React.ReactElement {
  const { login, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({
    email: undefined,
    password: undefined,
    general: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form validasyonu
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      email: undefined,
      password: undefined,
      general: undefined,
    };

    if (!email.trim()) {
      newErrors.email = 'Email adresi gereklidir';
    } else if (!isValidEmail(email)) {
      newErrors.email = ERROR_MESSAGES.AUTH_001;
    }

    if (!password) {
      newErrors.password = 'Şifre gereklidir';
    } else if (!isValidPassword(password)) {
      newErrors.password = ERROR_MESSAGES.AUTH_002;
    }

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  // Form gönderimi
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Client-side validasyon
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({
      email: undefined,
      password: undefined,
      general: undefined,
    });

    try {
      const result = await login(email, password);

      if (result.success) {
        toast({
          title: 'Giriş Başarılı',
          description: 'Yönlendiriliyorsunuz...',
          variant: 'success',
        });
        
        // Cookie'nin set edilmesi için kısa bir bekleme
        // Sonra tam sayfa yenileme ile ana sayfaya git
        await new Promise(resolve => setTimeout(resolve, 100));
        window.location.replace('/');
      } else {
        // API hatası
        const errorMessage = result.error || ERROR_MESSAGES.AUTH_004;
        setErrors({
          email: undefined,
          password: undefined,
          general: errorMessage,
        });
        
        toast({
          title: 'Giriş Başarısız',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({
        email: undefined,
        password: undefined,
        general: 'Giriş işlemi sırasında bir hata oluştu',
      });
      
      toast({
        title: 'Hata',
        description: 'Giriş işlemi sırasında bir hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
      <Card className="w-full max-w-md bg-discord-dark border-discord-light">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-discord-text">
            Giriş Yap
          </CardTitle>
          <CardDescription className="text-discord-muted">
            SANIYE MODLARI Yetkili Kılavuzu
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Genel hata mesajı */}
            {errors.general && (
              <div className="p-3 rounded-md bg-discord-red/10 border border-discord-red/30">
                <p className="text-sm text-discord-red">{errors.general}</p>
              </div>
            )}

            {/* Email alanı */}
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
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                disabled={isLoading}
                className={errors.email ? 'border-discord-red focus-visible:ring-discord-red' : ''}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-sm text-discord-red">{errors.email}</p>
              )}
            </div>

            {/* Şifre alanı */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-discord-text">
                Şifre
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  disabled={isLoading}
                  className={`pr-10 ${errors.password ? 'border-discord-red focus-visible:ring-discord-red' : ''}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-discord-muted hover:text-discord-text transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-discord-red">{errors.password}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
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
                  Giriş yapılıyor...
                </span>
              ) : (
                'Giriş Yap'
              )}
            </Button>

            <p className="text-sm text-discord-muted text-center">
              Hesabınız yok mu?{' '}
              <Link
                href={'/register' as Route}
                className="text-discord-accent hover:underline font-medium"
              >
                Kayıt Ol
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
