'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadGuideContent } from '@/lib/content';
import { Input } from '@/components/ui/input';
import { Book, ChevronRight, Search } from 'lucide-react';

export default function GuidePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const allGuideContent = loadGuideContent();
  const guideContent = useMemo(() => {
    if (!searchQuery.trim()) return allGuideContent;
    const q = searchQuery.toLowerCase();
    return allGuideContent.filter(g =>
      g.title.toLowerCase().includes(q) || g.content.toLowerCase().includes(q) ||
      (g.keywords || []).some(k => k.toLowerCase().includes(q))
    );
  }, [allGuideContent, searchQuery]);

  const breadcrumbItems = [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Saniye Yetkili Kılavuzu', href: '/guide' },
  ];

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-discord-text mb-2">Saniye Yetkili Kılavuzu</h1>
          <p className="text-discord-muted">Moderasyon kuralları, prosedürler ve rehberler.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
          <Input type="text" placeholder="Kılavuz ara..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-discord-dark border-discord-light" />
        </div>
        <div className="space-y-3">
          {guideContent.length === 0 && searchQuery && (
            <div className="text-center py-8 text-discord-muted">&quot;{searchQuery}&quot; için sonuç bulunamadı.</div>
          )}
          {guideContent.map((guide) => (
            <Link key={guide.id} href={`/guide/${guide.slug}`}
              className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-discord-accent/10 rounded-lg">
                    <Book className="h-5 w-5 text-discord-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-discord-text group-hover:text-discord-accent transition-colors">{guide.title}</h3>
                    <p className="text-sm text-discord-muted line-clamp-1">{guide.content.substring(0, 100)}...</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-discord-muted group-hover:text-discord-accent transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
