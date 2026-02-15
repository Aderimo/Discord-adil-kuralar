'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadCommands } from '@/lib/content';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { CommandCategory } from '@/types/content';

const categoryLabels: Record<CommandCategory, string> = {
  ceza: 'Ceza Komutları', bilgi: 'Bilgi Komutları', sesli: 'Sesli Kanal Komutları', 'gk-plus': 'GK+ Komutları',
};

export default function CommandCategoryClient() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const category = params.category as CommandCategory;
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const valid: CommandCategory[] = ['ceza', 'bilgi', 'sesli', 'gk-plus'];
  if (!valid.includes(category)) {
    return <MainLayout sidebar={<Sidebar />}><div className="p-6 text-discord-muted">Kategori bulunamadı.</div></MainLayout>;
  }

  const allCommands = loadCommands();
  const commands = useMemo(() => {
    let f = allCommands.filter(c => (c.category || 'bilgi') === category);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(c => c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    return f;
  }, [allCommands, category, searchQuery]);

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/commands" label="Geri" />
          <Breadcrumb items={[
            { label: 'Ana Sayfa', href: '/' },
            { label: 'Komutlar', href: '/commands' },
            { label: categoryLabels[category], href: `/commands/${category}` },
          ]} />
        </div>
        <h1 className="text-2xl font-bold text-discord-text">{categoryLabels[category]}</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
          <Input type="text" placeholder="Komut ara..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-discord-dark border-discord-light" />
        </div>
        <div className="space-y-4">
          {commands.map(cmd => (
            <div key={cmd.id} id={cmd.id} className="bg-discord-dark border border-discord-light rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <h3 className="text-lg font-mono font-semibold text-discord-accent">{cmd.command}</h3>
                <div className="flex gap-1 flex-wrap">
                  {cmd.permissions.map(p => (
                    <span key={p} className="px-2 py-0.5 bg-discord-lighter text-discord-muted text-xs rounded">{p}</span>
                  ))}
                </div>
              </div>
              <p className="text-discord-muted text-sm">{cmd.description}</p>
              <div className="bg-discord-darker rounded p-3">
                <h4 className="text-xs font-medium text-discord-muted mb-1">Kullanım:</h4>
                <code className="text-sm text-discord-text font-mono">{cmd.usage}</code>
              </div>
              {cmd.examples.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-discord-text mb-2">Örnekler:</h4>
                  <div className="space-y-1">
                    {cmd.examples.map((ex, i) => (
                      <code key={i} className="block text-sm text-discord-muted font-mono bg-discord-darker rounded px-2 py-1">{ex}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
