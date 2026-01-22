'use client';

// Register Sayfası
// Requirement 1.1: Kullanıcı kayıt formunu doldurur ve "Beklemede" durumunda kaydedilir

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  AUTH_003: 'Bu email adresi zaten kullanılıyor',
  USERNAME_SHORT: 'Kullanıcı adı en az 3 karakter olmalıdır',
  USERNAME_LONG: 'Kullanıcı adı en fazla 32 karakter olabilir',
  USERNAME_INVALID: 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir',
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

// Kullanıcı adı validasyonu
function isValidUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: ERROR_MESSAGES.USERNAME_SHORT };
  }
  if (username.length > 32) {
    return { valid: false, error: ERROR_MESSAGES.USERNAME_LONG };
  }
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return { valid: false, error: ERROR_MESSAGES.USERNAME_INVALID };
  }
  return { valid: true };
}

interface FormErrors {
  username: string | undefined;
  email: string | undefined;
  password: string | undefined;
  general: string | undefined;
}

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const { register } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({
    username: undefined,
    email: undefined,
    password: undefined,
    general: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form validasyonu
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      username: undefined,
      email: undefined,
      password: undefined,
      general: undefined,
    };

    // Kullanıcı adı validasyonu
    const usernameValidation = isValidUsername(username);
    if (!username.trim()) {
      newErrors.username = 'Kullanıcı adı gereklidir';
    } else if (!usernameValidation.valid) {
      newErrors.username = usernameValidation.error;
    }

    // Email validasyonu
    if (!email.trim()) {
      newErrors.email = 'Email adresi gereklidir';
    } else if (!isValidEmail(email)) {
      newErrors.email = ERROR_MESSAGES.AUTH_001;
    }

    // Şifre validasyonu
    if (!password) {
      newErrors.password = 'Şifre gereklidir';
    } else if (!isValidPassword(password)) {
      newErrors.password = ERROR_MESSAGES.AUTH_002;
    }

    setErrors(newErrors);
    return !newErrors.username && !newErrors.email && !newErrors.password;
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
      username: undefined,
      email: undefined,
      password: undefined,
      general: undefined,
    });

    try {
      const result = await register(username, email, password);

      if (result.success) {
        setIsSuccess(true);
        toast({
          title: 'Kayıt Başarılı',
          description: 'Hesabınız oluşturuldu. Onay bekleniyor.',
          variant: 'success',
        });
      } else {
        // API hatası
        const errorMessage = result.error || 'Kayıt işlemi başarısız';
        
        // Email zaten kayıtlı hatası kontrolü
        if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('kullanıl')) {
          setErrors({
            username: undefined,
            email: ERROR_MESSAGES.AUTH_003,
            password: undefined,
            general: undefined,
          });
        } else {
          setErrors({
            username: undefined,
            email: undefined,
            password: undefined,
            general: errorMessage,
          });
        }
        
        toast({
          title: 'Kayıt Başarısız',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Register error:', error);
      setErrors({
        username: undefined,
        email: undefined,
        password: undefined,
        general: 'Kayıt işlemi sırasında bir hata oluştu',
      });
      
      toast({
        title: 'Hata',
        description: 'Kayıt işlemi sırasında bir hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Başarılı kayıt sonrası gösterilecek ekran
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
        <Card className="w-full max-w-md bg-discord-dark border-discord-light">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 bg-discord-green/20 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-discord-green"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold text-discord-text">
              Kayıt Başarılı!
            </CardTitle>
            <CardDescription className="text-discord-muted">
              Hesabınız oluşturuldu ve onay bekliyor.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="p-4 rounded-md bg-discord-lighter border border-discord-light">
              <h3 className="font-medium text-discord-text mb-2">Sonraki Adımlar:</h3>
              <ul className="text-sm text-discord-muted space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-discord-accent">1.</span>
                  <span>Bir yönetici hesabınızı inceleyecek</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-discord-accent">2.</span>
                  <span>Onaylandığınızda sisteme giriş yapabileceksiniz</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-discord-accent">3.</span>
                  <span>Yetki seviyeniz atanacak</span>
                </li>
              </ul>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              onClick={() => router.push('/login' as Route)}
              className="w-full"
            >
              Giriş Sayfasına Git
            </Button>
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
            Kayıt Ol
          </CardTitle>
          <CardDescription className="text-discord-muted">
            SANIYE MODLARI Saniye Yetkili Kılavuzu
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

            {/* Kullanıcı adı alanı */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-discord-text">
                Kullanıcı Adı
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="kullanici_adi"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) {
                    setErrors((prev) => ({ ...prev, username: undefined }));
                  }
                }}
                disabled={isSubmitting}
                className={errors.username ? 'border-discord-red focus-visible:ring-discord-red' : ''}
                autoComplete="username"
              />
              {errors.username && (
                <p className="text-sm text-discord-red">{errors.username}</p>
              )}
              <p className="text-xs text-discord-muted">
                3-32 karakter, sadece harf, rakam ve alt çizgi
              </p>
            </div>

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
                disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  className={`pr-10 ${errors.password ? 'border-discord-red focus-visible:ring-discord-red' : ''}`}
                  autoComplete="new-password"
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
              <p className="text-xs text-discord-muted">
                En az 8 karakter
              </p>
            </div>

            {/* Bilgilendirme */}
            <div className="p-3 rounded-md bg-discord-lighter border border-discord-light">
              <p className="text-xs text-discord-muted">
                <span className="text-discord-yellow">⚠️</span>{' '}
                Kayıt olduktan sonra hesabınız yönetici onayı bekleyecektir.
                Onaylandığınızda sisteme giriş yapabilirsiniz.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
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
                  Kayıt yapılıyor...
                </span>
              ) : (
                'Kayıt Ol'
              )}
            </Button>

            <p className="text-sm text-discord-muted text-center">
              Zaten hesabınız var mı?{' '}
              <Link
                href={'/login' as Route}
                className="text-discord-accent hover:underline font-medium"
              >
                Giriş Yap
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
