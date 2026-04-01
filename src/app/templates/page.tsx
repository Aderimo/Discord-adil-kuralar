'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Input } from '@/components/ui/input';
import { loadTemplates } from '@/lib/content';
import { useToast } from '@/hooks/use-toast';
import { FileText, Copy, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TemplatesPage(): React.ReactElement | null {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allTemplates = useMemo(() => loadTemplates(), []);

  // Tüm kategoriler
  const categories = useMemo(() => {
    const cats = Array.from(new Set(allTemplates.map(t => t.category))).filter(Boolean);
    return cats;
  }, [allTemplates]);

  // Filtreli şablonlar
  const templates = useMemo(() => {
    let f = allTemplates;
    if (categoryFilter !== 'all') f = f.filter(t => t.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(t => t.name.toLowerCase().includes(q) || t.message.toLowerCase().includes(q));
    }
    return f;
  }, [allTemplates, categoryFilter, searchQuery]);

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: 'Kopyalandı', description: 'Şablon metni panoya kopyalandı.' });
    } catch {
      toast({ title: 'Hata', description: 'Kopyalanamadı.', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) { return null; }

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={[{ label: 'Ana Sayfa', href: '/' }, { label: 'Şablonlar', href: '/templates' }]} />
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-discord-accent/10 rounded-lg">
            <FileText className="h-6 w-6 text-discord-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-discord-text">Ceza Şablonları</h1>
            <p className="text-discord-muted text-sm">
              {templates.length} / {allTemplates.length} şablon gösteriliyor
            </p>
          </div>
        </div>

        {/* Arama ve Filtreler */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
            <Input
              type="text"
              placeholder="Şablon ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 bg-discord-dark border-discord-light"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex items-center gap-1 bg-discord-dark border border-discord-light rounded-lg p-1 flex-shrink-0">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  categoryFilter === 'all' ? 'bg-discord-accent text-white' : 'text-discord-muted hover:text-discord-text'
                }`}
              >
                Tümü
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                    categoryFilter === cat ? 'bg-discord-accent text-white' : 'text-discord-muted hover:text-discord-text'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Şablon listesi */}
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-discord-light mb-4">
                <FileText className="h-8 w-8 text-discord-muted" />
              </div>
              <p className="text-discord-text font-medium">Şablon bulunamadı</p>
              <p className="text-discord-muted text-sm mt-1">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Filtreleri temizleyerek tüm şablonları görebilirsiniz'
                  : 'Henüz şablon eklenmemiş'}
              </p>
              {(searchQuery || categoryFilter !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
                  className="mt-3 text-sm text-discord-accent hover:underline"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          ) : (
            templates.map(tpl => (
              <div key={tpl.id} className="bg-discord-dark border border-discord-light rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-discord-text">{tpl.name}</h3>
                    <span className="text-xs text-discord-muted capitalize">{tpl.category}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(tpl.id, tpl.message)}
                    className={copiedId === tpl.id ? 'text-discord-green' : 'text-discord-accent hover:bg-discord-accent/10'}
                  >
                    {copiedId === tpl.id ? (
                      <><Check className="h-4 w-4 mr-1" /> Kopyalandı</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Kopyala</>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-discord-muted bg-discord-darker rounded p-3">{tpl.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
