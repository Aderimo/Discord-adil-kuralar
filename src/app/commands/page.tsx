'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadCommands } from '@/lib/content';
import { Gavel, Info, Mic, Shield, ChevronRight } from 'lucide-react';
import type { CommandCategory } from '@/types/content';

const categoryConfig: Record<CommandCategory, { 
  label: string; 
  description: string;
  icon: React.ReactNode; 
  color: string;
  requiredRole: string;
}> = {
  ceza: { 
    label: 'Ceza Komutları', 
    description: 'Mute, timeout, temprole ve diğer ceza komutları.',
    icon: <Gavel className="h-6 w-6" />,
    color: 'text-discord-red bg-discord-red/10',
    requiredRole: 'reg'
  },
  bilgi: { 
    label: 'Bilgi Komutları', 
    description: 'Kullanıcı bilgisi, sicil ve geçmiş sorgulama.',
    icon: <Info className="h-6 w-6" />,
    color: 'text-discord-accent bg-discord-accent/10',
    requiredRole: 'reg'
  },
  sesli: { 
    label: 'Sesli Kanal Komutları', 
    description: 'Voice channel yönetimi ve kullanıcı çekme.',
    icon: <Mic className="h-6 w-6" />,
    color: 'text-discord-green bg-discord-green/10',
    requiredRole: 'reg'
  },
  'gk-plus': { 
    label: 'GK+ Komutları', 
    description: 'Genel Koordinatör ve üstü için ban/unban komutları.',
    icon: <Shield className="h-6 w-6" />,
    color: 'text-discord-yellow bg-discord-yellow/10',
    requiredRole: 'gk'
  },
};

export default function CommandsPage(): React.ReactElement {
  const commands = useMemo(() => loadCommands(), []);

  // Her kategorideki komut sayısını hesapla
  const categoryCounts = useMemo(() => {
    const counts: Record<CommandCategory, number> = {
      ceza: 0,
      bilgi: 0,
      sesli: 0,
      'gk-plus': 0,
    };
    commands.forEach((cmd) => {
      const cat = cmd.category || 'bilgi';
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [commands]);

  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Komutlar', href: '/commands' },
  ], []);

  const categories: CommandCategory[] = ['ceza', 'bilgi', 'sesli', 'gk-plus'];

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-discord-text mb-2">
            Moderasyon Komutları
          </h1>
          <p className="text-discord-muted">
            Tüm bot komutları ve kullanım örnekleri. Toplam {commands.length} komut.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => {
            const config = categoryConfig[category];
            const count = categoryCounts[category];
            
            return (
              <Link
                key={category}
                href={`/commands/${category}` as never}
                className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-discord-text group-hover:text-discord-accent transition-colors">
                        {config.label}
                      </h3>
                      <p className="text-sm text-discord-muted mt-1">
                        {config.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-discord-lighter px-2 py-1 rounded text-discord-muted">
                          {count} komut
                        </span>
                        {config.requiredRole !== 'reg' && (
                          <span className="text-xs bg-discord-yellow/20 px-2 py-1 rounded text-discord-yellow">
                            {config.requiredRole === 'gk' ? 'GK+' : config.requiredRole.toUpperCase()}
                          </span>
                        )}
                      </div>
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
