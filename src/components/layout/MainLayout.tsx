'use client';

/**
 * MainLayout - Ana layout bileşeni
 *
 * Sol sidebar + ana içerik alanı yapısı
 * Responsive tasarım (mobil/tablet/masaüstü)
 * Discord uyumlu koyu tema
 * Bildirim sistemi entegrasyonu
 *
 * Requirements: 8.1, 8.2, 8.3, 9.3
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  X,
  User,
  LogOut,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications';
import { hasPermission } from '@/lib/rbac';

// Props interface
export interface MainLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

// Rol etiketleri - dinamik roller dahil
const roleLabels: Record<string, string> = {
  none: 'Kullanıcı',
  reg: 'Regülatör',
  op: 'Operatör',
  gk: 'GateKeeper',
  council: 'Council',
  gm: 'GM',
  gm_plus: '🔖 GM+',
  owner: 'Owner',
  // Eski roller (geriye uyumluluk)
  mod: 'Moderatör',
  admin: 'Admin',
  ust_yetkili: 'Üst Yetkili',
};

// Rol renkleri - dinamik roller dahil
const roleColors: Record<string, string> = {
  none: 'text-discord-muted',
  reg: 'text-green-400',
  op: 'text-blue-400',
  gk: 'text-orange-400',
  council: 'text-purple-400',
  gm: 'text-red-400',
  gm_plus: 'text-yellow-400',
  owner: 'text-white',
  // Eski roller (geriye uyumluluk)
  mod: 'text-discord-green',
  admin: 'text-discord-accent',
  ust_yetkili: 'text-discord-yellow',
};

export function MainLayout({ children, sidebar }: MainLayoutProps): React.ReactElement {
  const { user, logout, isLoading } = useAuthContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Kullanıcının bildirim görüntüleme yetkisi var mı?
  const canViewNotifications = user?.role
    ? hasPermission(user.role, 'VIEW_NOTIFICATIONS')
    : false;

  // Sidebar toggle
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Sidebar'ı kapat (mobil için)
  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Çıkış işlemi
  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Yükleniyor durumu
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-discord-darker">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          <span className="text-discord-muted">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-discord-darker">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-discord-light bg-discord-dark px-4">
        {/* Sol taraf - Logo ve mobil menü butonu */}
        <div className="flex items-center gap-3">
          {/* Mobil menü butonu */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
            aria-label={isSidebarOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          {/* Logo / Başlık - Ana sayfaya link */}
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Shield className="h-6 w-6 text-discord-accent" />
            <span className="hidden font-semibold text-discord-text sm:inline-block">
              Yetkili Kılavuzu
            </span>
          </Link>
        </div>

        {/* Sağ taraf - Bildirimler ve Kullanıcı bilgisi */}
        <div className="flex items-center gap-2">
          {/* Bildirim ikonu - sadece yetkili kullanıcılar için */}
          {user && canViewNotifications && (
            <NotificationBell className="text-discord-muted hover:text-discord-text" />
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2 sm:px-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-lighter">
                    <User className="h-4 w-4 text-discord-text" />
                  </div>
                  <div className="hidden flex-col items-start sm:flex">
                    <span className="text-sm font-medium text-discord-text">
                      {user.username}
                    </span>
                    <span
                      className={`text-xs ${roleColors[user.role || ''] || 'text-discord-muted'
                        }`}
                    >
                      {roleLabels[user.role || ''] || user.role || 'Kullanıcı'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-discord-muted" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.username}</span>
                    <span className="text-xs text-discord-muted">
                      {user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="sm:hidden">
                  <User className="mr-2 h-4 w-4" />
                  <span
                    className={
                      roleColors[user.role || ''] || 'text-discord-muted'
                    }
                  >
                    {roleLabels[user.role || ''] || user.role || 'Kullanıcı'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-discord-red focus:text-discord-red"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Çıkış Yap</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Ana içerik alanı */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar overlay (mobil) */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 mt-14 w-72 transform border-r border-discord-light
            bg-discord-dark transition-transform duration-300 ease-in-out
            md:w-64 lg:static lg:mt-0 lg:translate-x-0 lg:w-64
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex h-full flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-discord-light scrollbar-track-transparent">
            {sidebar || (
              <div className="flex flex-1 items-center justify-center p-4">
                <span className="text-discord-muted">Sidebar içeriği</span>
              </div>
            )}
          </div>
        </aside>

        {/* Ana içerik */}
        <main className="flex-1 overflow-y-auto bg-discord-darker">
          <div className="h-full w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
