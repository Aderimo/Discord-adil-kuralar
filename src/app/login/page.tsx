'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  if (isAuthenticated) {
    router.push('/');
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (login(password)) {
      router.push('/');
    } else {
      setError('Yanlış şifre');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-discord-accent/10 mb-4">
            <Shield className="w-8 h-8 text-discord-accent" />
          </div>
          <h1 className="text-2xl font-bold text-discord-text">
            Saniye Yetkili Kılavuzu
          </h1>
          <p className="text-discord-muted text-sm mt-2">
            Erişim için şifre girin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifre"
              className="w-full bg-discord-dark border border-discord-light rounded-lg px-4 py-3 text-discord-text placeholder:text-discord-muted focus:outline-none focus:ring-2 focus:ring-discord-accent focus:border-transparent pr-12"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-discord-muted hover:text-discord-text transition-colors"
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <p className="text-discord-red text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-discord-accent hover:bg-discord-accent/90 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
}
