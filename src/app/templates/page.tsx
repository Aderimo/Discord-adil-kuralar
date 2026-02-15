'use client';

import React, { useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadTemplates } from '@/lib/content';
import { useToast } from '@/hooks/use-toast';
import { FileText, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TemplatesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const templates = useMemo(() => loadTemplates(), []);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Kopyalandı', description: 'Şablon metni panoya kopyalandı.' });
    } catch {
      toast({ title: 'Hata', description: 'Kopyalanamadı.', variant: 'destructive' });
    }
  }, [toast]);

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
            <p className="text-discord-muted text-sm">Toplam {templates.length} şablon.</p>
          </div>
        </div>
        <div className="space-y-4">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-discord-dark border border-discord-light rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-discord-text">{tpl.name}</h3>
                  <span className="text-xs text-discord-muted capitalize">{tpl.category}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(tpl.message)}
                  className="text-discord-accent hover:bg-discord-accent/10">
                  <Copy className="h-4 w-4 mr-1" /> Kopyala
                </Button>
              </div>
              <p className="text-sm text-discord-muted bg-discord-darker rounded p-3">{tpl.message}</p>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
