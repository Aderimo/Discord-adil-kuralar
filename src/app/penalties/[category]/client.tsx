'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadPenalties } from '@/lib/content';
import { Input } from '@/components/ui/input';
import { Search, Copy, Check } from 'lucide-react';
import type { PenaltyCategory } from '@/types/content';

const categoryLabels: Record<PenaltyCategory, string> = {
  yazili: 'Yazılı Cezalar', sesli: 'Sesli Cezalar', ekstra: 'Ekstra Cezalar',
  marked: 'Marked', blacklist: 'Blacklist',
};

const VALID_CATEGORIES: PenaltyCategory[] = ['yazili', 'sesli', 'ekstra', 'marked', 'blacklist'];

export default function PenaltyCategoryClient(): React.ReactElement | null {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const category = params.category as PenaltyCategory;
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (penaltyId: string, text: string): void => {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }).finally(() => {
      setCopiedId(penaltyId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const allPenalties = loadPenalties();
  const penalties = useMemo(() => {
    let f = allPenalties.filter(p => p.category === category);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return f;
  }, [allPenalties, category, searchQuery]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) { return null; }

  if (!VALID_CATEGORIES.includes(category)) {
    return <MainLayout sidebar={<Sidebar />}><div className="p-6 text-discord-muted">Kategori bulunamadı.</div></MainLayout>;
  }

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/penalties" label="Geri" />
          <Breadcrumb items={[
            { label: 'Ana Sayfa', href: '/' },
            { label: 'Cezalar', href: '/penalties' },
            { label: categoryLabels[category], href: `/penalties/${category}` },
          ]} />
        </div>
        <h1 className="text-2xl font-bold text-discord-text">{categoryLabels[category]}</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
          <Input type="text" placeholder="Ceza ara..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-discord-dark border-discord-light" />
        </div>
        <div className="space-y-4">
          {penalties.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-discord-light mb-4">
                <Search className="h-8 w-8 text-discord-muted" />
              </div>
              <p className="text-discord-text font-medium">Ceza bulunamadı</p>
              <p className="text-discord-muted text-sm mt-1">
                {searchQuery ? `"${searchQuery}" aramasına uygun ceza yok` : 'Bu kategoride ceza tanımı bulunmuyor'}
              </p>
            </div>
          )}
          {penalties.map(p => (
            <div key={p.id} className="bg-discord-dark border border-discord-light rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-discord-text">{p.name}</h3>
                  <span className="text-sm text-discord-accent font-mono">{p.code}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-3 py-1 bg-discord-red/20 text-discord-red text-sm rounded-full">{p.duration}</span>
                  <button
                    onClick={() => handleCopy(p.id, `Ceza: ${p.name}\nKod: ${p.code}\nSüre: ${p.duration}\nAçıklama: ${p.description}`)}
                    title="Ceza kaydını kopyala"
                    className="p-1.5 rounded text-discord-muted hover:text-discord-text hover:bg-discord-lighter transition-colors"
                  >
                    {copiedId === p.id ? (
                      <Check className="h-4 w-4 text-discord-green" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-discord-muted text-sm">{p.description}</p>
              {p.conditions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-discord-text mb-1">Koşullar:</h4>
                  <ul className="list-disc list-inside text-sm text-discord-muted space-y-1">
                    {p.conditions.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {p.alternatives && p.alternatives.length > 0 && (
                <div className="pt-2 border-t border-discord-light">
                  <h4 className="text-sm font-medium text-discord-yellow mb-1">Alternatifler:</h4>
                  <ul className="list-disc list-inside text-sm text-discord-muted space-y-1">
                    {p.alternatives.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
