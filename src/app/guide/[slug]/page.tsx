'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useParams, notFound } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { ContentViewer } from '@/components/content/ContentViewer';
import { ContentEditor } from '@/components/content/ContentEditor';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadGuideContent } from '@/lib/content';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Edit3 } from 'lucide-react';
import type { GuideContent, CommandDefinition, PenaltyDefinition, ProcedureDefinition } from '@/types/content';

export default function GuidePage(): React.ReactElement {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const guideContent = useMemo(() => loadGuideContent(), []);
  const guide = useMemo(() => 
    guideContent.find(g => g.slug === slug),
    [guideContent, slug]
  );

  // Sadece ust_yetkili rolü düzenleme yapabilir
  const canEdit = user?.role && hasRole(user.role, 'ust_yetkili');

  // Breadcrumb öğeleri
  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Yetkili Kılavuzu', href: '/guide' },
    { label: guide?.title || 'Yükleniyor...', href: `/guide/${slug}` },
  ], [guide?.title, slug]);

  // İçerik kaydetme
  const handleSave = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      const response = await fetch(`/api/content/sections/${guide?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'guide',
          data: content,
        }),
      });

      if (!response.ok) {
        throw new Error('İçerik kaydedilemedi');
      }

      // Sayfayı yenile
      window.location.reload();
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      throw error;
    }
  }, [guide?.id]);

  // Düzenlemeyi iptal et
  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  if (!guide) {
    notFound();
  }

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto">
        {/* Navigasyon bileşenleri */}
        <div className="mb-6 space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Düzenleme butonu - sadece ust_yetkili için */}
        {canEdit && !isEditing && (
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="gap-2 text-discord-accent border-discord-accent hover:bg-discord-accent/10"
            >
              <Edit3 className="h-4 w-4" />
              Düzenle
            </Button>
          </div>
        )}

        {/* Düzenleme modu veya görüntüleme modu */}
        {isEditing ? (
          <ContentEditor
            type="guide"
            content={guide}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <ContentViewer
            type="guide"
            content={guide}
            userId={user?.id}
          />
        )}
      </div>
    </MainLayout>
  );
}
