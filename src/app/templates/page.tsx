'use client';

/**
 * Şablonlar Sayfası
 * Ceza şablonlarını listeler ve kopyalama/düzenleme işlevleri sunar
 *
 * Requirement 8.1: THE System SHALL provide pre-defined ban message templates for common scenarios
 * Requirement 12.3: WHEN a user copies a template or content THEN THE System SHALL log the copy action with content details
 */

import React, { useMemo, useCallback, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { PenaltyTemplates } from '@/components/templates/PenaltyTemplates';
import { loadTemplates } from '@/lib/content';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FileText } from 'lucide-react';
import type { PenaltyTemplate } from '@/types/templates';

export default function TemplatesPage(): React.ReactElement {
  const templates = useMemo(() => loadTemplates(), []);
  const canEdit = usePermission('EDIT_TEMPLATES');
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLastCopied] = useState<string | null>(null);

  // Breadcrumb öğeleri
  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Şablonlar', href: '/templates' },
  ], []);

  /**
   * Şablon metnini panoya kopyalar
   * Requirement 8.4: WHEN a user clicks the copy button THEN THE System SHALL copy the template text to clipboard
   */
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setLastCopied(text);
      toast({
        title: 'Kopyalandı',
        description: 'Şablon metni panoya kopyalandı.',
      });
    } catch (error) {
      console.error('Kopyalama hatası:', error);
      toast({
        title: 'Hata',
        description: 'Şablon kopyalanamadı.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  /**
   * Şablon düzenleme işlevi
   * Requirement 8.5: WHEN an üst_yetkili edits a template THEN THE System SHALL save the changes
   */
  const handleEdit = useCallback(async (template: PenaltyTemplate) => {
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: template.name,
          message: template.message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Şablon güncellenemedi');
      }

      toast({
        title: 'Başarılı',
        description: 'Şablon güncellendi.',
      });

      // Sayfayı yenile
      window.location.reload();
    } catch (error) {
      console.error('Düzenleme hatası:', error);
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Şablon güncellenemedi.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-discord-accent/10 rounded-lg">
                <FileText className="h-6 w-6 text-discord-accent" />
              </div>
              <h1 className="text-2xl font-bold text-discord-text">
                Ceza Şablonları
              </h1>
            </div>
            <p className="text-discord-muted">
              Hazır ban ve ceza mesaj şablonları. Toplam {templates.length} şablon.
            </p>
          </div>
        </div>

        <PenaltyTemplates
          templates={templates}
          canEdit={canEdit}
          onCopy={handleCopy}
          {...(canEdit && { onEdit: handleEdit })}
          userId={user?.id}
        />
      </div>
    </MainLayout>
  );
}
