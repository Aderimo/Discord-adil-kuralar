'use client';

import React, { Suspense, useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { ContentEditor } from '@/components/content/ContentEditor';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadGuideContent } from '@/lib/content';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Plus, Book, ChevronRight, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { GuideContent, PenaltyDefinition, CommandDefinition, ProcedureDefinition } from '@/types/content';

function GuidePageContent(): React.ReactElement {
  const allGuideContent = useMemo(() => loadGuideContent(), []);
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // URL'den ?add=true parametresini kontrol et
  useEffect(() => {
    if (searchParams.get('add') === 'true' && user?.role && hasRole(user.role, 'gm_plus')) {
      setIsAddingNew(true);
      // URL'den parametreyi temizle
      window.history.replaceState({}, '', '/guide');
    }
  }, [searchParams, user?.role]);

  // Arama filtresi
  const guideContent = useMemo(() => {
    if (!searchQuery.trim()) {
      return allGuideContent;
    }
    const query = searchQuery.toLowerCase();
    return allGuideContent.filter(guide =>
      guide.title.toLowerCase().includes(query) ||
      guide.content.toLowerCase().includes(query) ||
      (guide.keywords || []).some(k => k.toLowerCase().includes(query))
    );
  }, [allGuideContent, searchQuery]);

  // Sadece gm_plus ve owner rolü düzenleme yapabilir
  const canEdit = user?.role && hasRole(user.role, 'gm_plus');

  // Breadcrumb öğeleri
  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Saniye Yetkili Kılavuzu', href: '/guide' },
  ], []);

  // Yeni içerik ekleme
  const handleAddNew = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      const guideData = content as GuideContent;
      const newId = `guide-${Date.now()}`;
      const newContent = {
        ...guideData,
        id: newId,
        category: 'kilavuz',
        relatedArticles: [],
        order: allGuideContent.length + 1,
      };

      const response = await fetch('/api/content/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'guide',
          data: newContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'İçerik eklenemedi');
      }

      window.location.reload();
    } catch (error) {
      console.error('Ekleme hatası:', error);
      throw error;
    }
  }, [allGuideContent.length]);

  const handleCancel = useCallback(() => {
    setIsAddingNew(false);
  }, []);

  // İçerik silme
  const handleDelete = useCallback(async (guideId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Bu kılavuz bölümünü silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    setDeletingId(guideId);
    try {
      const response = await fetch(`/api/content/sections/${guideId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('İçerik silinemedi');
      }

      window.location.reload();
    } catch (error) {
      console.error('Silme hatası:', error);
      alert('Silme işlemi başarısız oldu');
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-discord-text mb-2">
              Saniye Yetkili Kılavuzu
            </h1>
            <p className="text-discord-muted">
              Moderasyon kuralları, prosedürler ve rehberler.
            </p>
          </div>
          {canEdit && !isAddingNew && (
            <Button
              onClick={() => setIsAddingNew(true)}
              className="gap-2 bg-discord-green hover:bg-discord-green/90"
            >
              <Plus className="h-4 w-4" />
              Yeni Bölüm Ekle
            </Button>
          )}
        </div>

        {isAddingNew && (
          <ContentEditor
            type="guide"
            content={null}
            onSave={handleAddNew}
            onCancel={handleCancel}
          />
        )}

        {/* Arama kutusu */}
        {!isAddingNew && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
            <Input
              type="text"
              placeholder="Kılavuz ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-discord-dark border-discord-light"
            />
          </div>
        )}

        {!isAddingNew && (
          <div className="space-y-3">
            {guideContent.length === 0 && searchQuery && (
              <div className="text-center py-8 text-discord-muted">
                &quot;{searchQuery}&quot; için sonuç bulunamadı.
              </div>
            )}
            {guideContent.map((guide) => (
              <div key={guide.id} className="relative group">
                <Link
                  href={`/guide/${guide.slug}` as never}
                  className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-discord-accent/10 rounded-lg">
                        <Book className="h-5 w-5 text-discord-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-discord-text group-hover:text-discord-accent transition-colors">
                          {guide.title}
                        </h3>
                        <p className="text-sm text-discord-muted line-clamp-1">
                          {guide.content.substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-discord-muted group-hover:text-discord-accent transition-colors" />
                  </div>
                </Link>
                {/* Silme butonu - sadece gm_plus için */}
                {canEdit && (
                  <Button
                    onClick={(e) => handleDelete(guide.id, e)}
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-discord-red hover:bg-discord-red/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Sil"
                    disabled={deletingId === guide.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function GuidePage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-discord-muted">Yükleniyor...</div></div>}>
      <GuidePageContent />
    </Suspense>
  );
}
