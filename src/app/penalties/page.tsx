'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadPenalties } from '@/lib/content';
import { AlertTriangle, Mic, Plus, Flag, Skull, ChevronRight } from 'lucide-react';
import type { PenaltyCategory } from '@/types/content';

const categoryConfig: Record<PenaltyCategory, { 
  label: string; 
  description: string;
  icon: React.ReactNode; 
  color: string;
}> = {
  yazili: { 
    label: 'Yazılı Cezalar', 
    description: 'Yazılı kanallardaki ihlaller için uygulanan cezalar.',
    icon: <AlertTriangle className="h-6 w-6" />,
    color: 'text-discord-yellow bg-discord-yellow/10'
  },
  sesli: { 
    label: 'Sesli Cezalar', 
    description: 'Sesli kanallardaki ihlaller için uygulanan cezalar.',
    icon: <Mic className="h-6 w-6" />,
    color: 'text-discord-accent bg-discord-accent/10'
  },
  ekstra: { 
    label: 'Ekstra Cezalar', 
    description: 'Özel durumlar ve ağır ihlaller için uygulanan cezalar.',
    icon: <Plus className="h-6 w-6" />,
    color: 'text-discord-green bg-discord-green/10'
  },
  marked: { 
    label: 'Marked (İzleme Listesi)', 
    description: 'İzleme altına alınan kullanıcılar için uygulanan işaretlemeler.',
    icon: <Flag className="h-6 w-6" />,
    color: 'text-orange-400 bg-orange-400/10'
  },
  blacklist: { 
    label: 'Blacklist (Kara Liste)', 
    description: 'En ağır ihlaller için uygulanan kalıcı yasaklar.',
    icon: <Skull className="h-6 w-6" />,
    color: 'text-discord-red bg-discord-red/10'
  },
};

export default function PenaltiesPage(): React.ReactElement {
  const penalties = useMemo(() => loadPenalties(), []);

  // Her kategorideki ceza sayısını hesapla
  const categoryCounts = useMemo(() => {
    const counts: Record<PenaltyCategory, number> = {
      yazili: 0,
      sesli: 0,
      ekstra: 0,
      marked: 0,
      blacklist: 0,
    };
    penalties.forEach((p) => {
      if (counts[p.category] !== undefined) {
        counts[p.category]++;
      }
    });
    return counts;
  }, [penalties]);

  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Cezalar', href: '/penalties' },
  ], []);

  const categories: PenaltyCategory[] = ['yazili', 'sesli', 'ekstra', 'marked', 'blacklist'];

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-discord-text mb-2">
            Cezalar
          </h1>
          <p className="text-discord-muted">
            Tüm ceza türleri ve kategorileri. Toplam {penalties.length} ceza tanımı.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => {
            const config = categoryConfig[category];
            const count = categoryCounts[category];
            
            return (
              <Link
                key={category}
                href={`/penalties/${category}` as never}
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
                      <span className="inline-block mt-2 text-xs bg-discord-lighter px-2 py-1 rounded text-discord-muted">
                        {count} ceza
                      </span>
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
