'use client';

import React, { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { ContentEditor } from '@/components/content/ContentEditor';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadProcedures } from '@/lib/content';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Plus, FileText, ChevronRight } from 'lucide-react';
import type { GuideContent, PenaltyDefinition, CommandDefinition, ProcedureDefinition } from '@/types/content';

export default function ProceduresPage(): React.ReactElement {
  const procedures = useMemo(() => loadProcedures(), []);
  const { user } = useAuth();
  const [isAddingNew, setIsAddingNew] = useState(false);

  const canEdit = user?.role && hasRole(user.role, 'ust_yetkili');

  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Prosedürler', href: '/procedures' },
  ], []);

  const handleAddNew = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      const procData = content as ProcedureDefinition;
      const newId = `proc-${Date.now()}`;
      const newContent = {
        ...procData,
        id: newId,
        order: procedures.length + 1,
      };

      const response = await fetch('/api/content/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'procedure',
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
  }, [procedures.length]);

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
              Prosedürler
            </h1>
            <p className="text-discord-muted">
              İşlem adımları ve yönergeler.
            </p>
          </div>
          {canEdit && !isAddingNew && (
            <Button
              onClick={() => setIsAddingNew(true)}
              className="gap-2 bg-discord-green hover:bg-discord-green/90"
            >
              <Plus className="h-4 w-4" />
              Yeni Prosedür Ekle
            </Button>
          )}
        </div>

        {isAddingNew && (
          <ContentEditor
            type="procedure"
            content={null}
            onSave={handleAddNew}
            onCancel={handleCancel}
          />
        )}

        {!isAddingNew && (
          <div className="space-y-3">
            {procedures.map((proc) => (
              <Link
                key={proc.id}
                href={`/procedures/${proc.slug}` as never}
                className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-discord-yellow/10 rounded-lg">
                      <FileText className="h-5 w-5 text-discord-yellow" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-discord-text group-hover:text-discord-accent transition-colors">
                        {proc.title}
                      </h3>
                      <p className="text-sm text-discord-muted">
                        {proc.description}
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
