'use client';

// Admin Layout - Admin navigasyon sidebar'ı ile
// Requirement 3.1, 3.2, 3.3, 3.4, 3.5: Admin paneli için layout

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Users, ScrollText, Settings, Shield, LogOut, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Rol bazlı erişim kontrolleri
const OWNER_ROLES = ['owner', 'ust_yetkili'];
const LOG_ROLES = ['gm', 'gm_plus', 'owner', 'ust_yetkili'];
const ADMIN_ROLES = ['owner', 'admin', 'ust_yetkili', 'gk', 'council', 'gm', 'gm_plus'];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  // Yükleniyor durumu
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-discord-darker">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          <p className="text-discord-muted">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Yetkisiz erişim kontrolü - owner, admin ve ust_yetkili erişebilir
  // Ayrıca yeni rol sistemindeki gk, council, gm, gm_plus rolleri de erişebilir
  if (!user || !ADMIN_ROLES.includes(user.role || '')) {
    return (
      <div className="flex h-screen items-center justify-center bg-discord-darker">
        <div className="text-center">
          <Shield className="mx-auto h-16 w-16 text-discord-red mb-4" />
          <h1 className="text-2xl font-bold text-discord-text mb-2">Erişim Reddedildi</h1>
          <p className="text-discord-muted mb-6">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <Button onClick={() => router.push('/')} variant="secondary">
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    );
  }

  // Rol bazlı menü görünürlüğü
  const canViewLogs = LOG_ROLES.includes(user.role || '');
  const canViewSettings = OWNER_ROLES.includes(user.role || '');

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push('/login');
  };

  const navigateTo = (path: string): void => {
    router.push(path as Parameters<typeof router.push>[0]);
  };

  return (
    <div className="flex h-screen bg-discord-darker">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-discord-dark border-r border-discord-light">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-discord-light p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-accent">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-discord-text">Admin Panel</h1>
              <p className="text-xs text-discord-muted">SANIYE MODLARI</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3">
            <button
              onClick={() => navigateTo('/admin')}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
                pathname === '/admin'
                  ? 'bg-discord-accent/20 text-discord-accent'
                  : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
              )}
            >
              <Users className="h-5 w-5" />
              Kullanıcılar
            </button>
            
            {/* Aktivite Logları - sadece gm ve üstü */}
            {canViewLogs && (
              <button
                onClick={() => navigateTo('/admin/logs')}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
                  pathname === '/admin/logs'
                    ? 'bg-discord-accent/20 text-discord-accent'
                    : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
                )}
              >
                <ScrollText className="h-5 w-5" />
                Aktivite Logları
              </button>
            )}
            
            {/* Ayarlar (Rol Yönetimi) - sadece owner */}
            {canViewSettings && (
              <button
                onClick={() => navigateTo('/admin/settings')}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
                  pathname === '/admin/settings'
                    ? 'bg-discord-accent/20 text-discord-accent'
                    : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
                )}
              >
                <Settings className="h-5 w-5" />
                Ayarlar
              </button>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t border-discord-light p-3 space-y-2">
            <button
              onClick={() => navigateTo('/')}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-discord-muted hover:bg-discord-light hover:text-discord-text transition-colors text-left"
            >
              <Home className="h-5 w-5" />
              Ana Sayfa
            </button>
            
            <div className="flex items-center gap-3 rounded-md bg-discord-light px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-accent text-xs font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-discord-text">
                  {user.username}
                </p>
                <p className="truncate text-xs text-discord-muted capitalize">
                  {user.role === 'ust_yetkili' ? 'Üst Yetkili' : user.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded p-1 text-discord-muted hover:bg-discord-lighter hover:text-discord-red transition-colors"
                title="Çıkış Yap"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
