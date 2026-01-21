'use client';

import React, { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { ContentEditor } from '@/components/content/ContentEditor';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadGuideContent } from '@/lib/content';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Plus, Book, ChevronRight } from 'lucide-react';
import type { GuideContent, PenaltyDefinition, CommandDefinition, ProcedureDefinition } from '@/types/content';

export default function GuidePage(): React.ReactElement {
  const guideContent = useMemo(() => loadGuideContent(), []);
  const { user } = useAuth();
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Sadece ust_yetkili rolü düzenleme yapabilir
  const canEdit = user?.role && hasRole(user.role, 'ust_yetkili');

  // Breadcrumb öğeleri
  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Yetkili Kılavuzu', href: '/guide' },
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
        order: guideContent.length + 1,
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
  }, [guideContent.length]);

  const handleCancel = useCallback(() => {
    setIsAddingNew(false);
  }, []);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-discord-text mb-2">
              Yetkili Kılavuzu
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

        {!isAddingNew && (
          <div className="space-y-3">
            {guideContent.map((guide) => (
              <Link
                key={guide.id}
                href={`/guide/${guide.slug}` as never}
                className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors group"
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
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
