'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadCommands } from '@/lib/content';
import { Input } from '@/components/ui/input';
import { Search, Copy, Check } from 'lucide-react';
import type { CommandCategory } from '@/types/content';

const categoryLabels: Record<CommandCategory, string> = {
  ceza: 'Ceza Komutları', bilgi: 'Bilgi Komutları', sesli: 'Sesli Kanal Komutları', 'gk-plus': 'GK+ Komutları',
};

const VALID_CATEGORIES: CommandCategory[] = ['ceza', 'bilgi', 'sesli', 'gk-plus'];

export default function CommandCategoryClient(): React.ReactElement | null {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const category = params.category as CommandCategory;
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      // fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const allCommands = loadCommands();
  const commands = useMemo(() => {
    let f = allCommands.filter(c => (c.category || 'bilgi') === category);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(c => c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    return f;
  }, [allCommands, category, searchQuery]);

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
          {commands.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-discord-light mb-4">
                <Search className="h-8 w-8 text-discord-muted" />
              </div>
              <p className="text-discord-text font-medium">Komut bulunamadı</p>
              <p className="text-discord-muted text-sm mt-1">
                {searchQuery ? `"${searchQuery}" aramasına uygun komut yok` : 'Bu kategoride komut bulunmuyor'}
              </p>
            </div>
          )}
          {commands.map(cmd => (
            <div key={cmd.id} id={cmd.id} className="bg-discord-dark border border-discord-light rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-mono font-semibold text-discord-accent">{cmd.command}</h3>
                  <button
                    onClick={() => handleCopy(cmd.command, `cmd-${cmd.id}`)}
                    title="Komutu kopyala"
                    className="p-1 rounded text-discord-muted hover:text-discord-text hover:bg-discord-lighter transition-colors"
                  >
                    {copiedId === `cmd-${cmd.id}` ? (
                      <Check className="h-3.5 w-3.5 text-discord-green" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {cmd.permissions.map(p => (
                    <span key={p} className="px-2 py-0.5 bg-discord-lighter text-discord-muted text-xs rounded">{p}</span>
                  ))}
                </div>
              </div>
              <p className="text-discord-muted text-sm">{cmd.description}</p>
              <div className="bg-discord-darker rounded p-3 relative group/usage">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium text-discord-muted">Kullanım:</h4>
                  <button
                    onClick={() => handleCopy(cmd.usage, `usage-${cmd.id}`)}
                    title="Kullanımı kopyala"
                    className="opacity-0 group-hover/usage:opacity-100 p-1 rounded text-discord-muted hover:text-discord-text transition-all"
                  >
                    {copiedId === `usage-${cmd.id}` ? (
                      <Check className="h-3 w-3 text-discord-green" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
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
