'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadPenalties } from '@/lib/content';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { PenaltyCategory } from '@/types/content';

const categoryLabels: Record<PenaltyCategory, string> = {
  yazili: 'Yazılı Cezalar', sesli: 'Sesli Cezalar', ekstra: 'Ekstra Cezalar',
  marked: 'Marked', blacklist: 'Blacklist',
};

export default function PenaltyCategoryClient() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const category = params.category as PenaltyCategory;
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const valid: PenaltyCategory[] = ['yazili', 'sesli', 'ekstra', 'marked', 'blacklist'];
  if (!valid.includes(category)) {
    return <MainLayout sidebar={<Sidebar />}><div className="p-6 text-discord-muted">Kategori bulunamadı.</div></MainLayout>;
  }

  const allPenalties = loadPenalties();
  const penalties = useMemo(() => {
    let f = allPenalties.filter(p => p.category === category);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return f;
  }, [allPenalties, category, searchQuery]);

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
          {penalties.map(p => (
            <div key={p.id} className="bg-discord-dark border border-discord-light rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-discord-text">{p.name}</h3>
                  <span className="text-sm text-discord-accent font-mono">{p.code}</span>
                </div>
                <span className="px-3 py-1 bg-discord-red/20 text-discord-red text-sm rounded-full">{p.duration}</span>
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
