'use client';

import React, { useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadCommands } from '@/lib/content';
import { Gavel, Info, Mic, Shield, ChevronRight } from 'lucide-react';
import type { CommandCategory } from '@/types/content';

const categoryConfig: Record<CommandCategory, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  ceza: { label: 'Ceza Komutları', description: 'Mute, timeout, temprole komutları.', icon: <Gavel className="h-6 w-6" />, color: 'text-discord-red bg-discord-red/10' },
  bilgi: { label: 'Bilgi Komutları', description: 'Kullanıcı bilgisi ve sicil sorgulama.', icon: <Info className="h-6 w-6" />, color: 'text-discord-accent bg-discord-accent/10' },
  sesli: { label: 'Sesli Kanal Komutları', description: 'Voice channel yönetimi.', icon: <Mic className="h-6 w-6" />, color: 'text-discord-green bg-discord-green/10' },
  'gk-plus': { label: 'GK+ Komutları', description: 'Ban/unban komutları.', icon: <Shield className="h-6 w-6" />, color: 'text-discord-yellow bg-discord-yellow/10' },
};

export default function CommandsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const commands = loadCommands();
  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    commands.forEach(cmd => { const cat = cmd.category || 'bilgi'; c[cat] = (c[cat] || 0) + 1; });
    return c;
  }, [commands]);

  const categories: CommandCategory[] = ['ceza', 'bilgi', 'sesli', 'gk-plus'];

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={[{ label: 'Ana Sayfa', href: '/' }, { label: 'Komutlar', href: '/commands' }]} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-discord-text mb-2">Moderasyon Komutları</h1>
          <p className="text-discord-muted">Toplam {commands.length} komut.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map(cat => {
            const cfg = categoryConfig[cat];
            return (
              <Link key={cat} href={`/commands/${cat}`}
                className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${cfg.color}`}>{cfg.icon}</div>
                    <div>
                      <h3 className="font-semibold text-discord-text group-hover:text-discord-accent transition-colors">{cfg.label}</h3>
                      <p className="text-sm text-discord-muted mt-1">{cfg.description}</p>
                      <span className="inline-block mt-2 text-xs bg-discord-lighter px-2 py-1 rounded text-discord-muted">{categoryCounts[cat] || 0} komut</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-discord-muted group-hover:text-discord-accent transition-colors flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
