'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, X, Shield, LogOut } from 'lucide-react';

export interface MainLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function MainLayout({ children, sidebar }: MainLayoutProps) {
  const { logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-discord-darker">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-discord-light bg-discord-dark px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
            aria-label={isSidebarOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="h-6 w-6 text-discord-accent" />
            <span className="hidden font-semibold text-discord-text sm:inline-block">
              Saniye Yetkili Kılavuzu
            </span>
          </Link>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-discord-muted hover:text-discord-red"
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Çıkış</span>
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-40 mt-14 w-72 transform border-r border-discord-light bg-discord-dark transition-transform duration-300 ease-in-out md:w-64 lg:static lg:mt-0 lg:translate-x-0 lg:w-64 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col overflow-y-auto">
            {sidebar}
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto bg-discord-darker">
          <div className="h-full w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
