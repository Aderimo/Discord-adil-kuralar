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
import { Plus, FileText, ChevronRight, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { GuideContent, PenaltyDefinition, CommandDefinition, ProcedureDefinition } from '@/types/content';

export default function ProceduresPage(): React.ReactElement {
  const allProcedures = useMemo(() => loadProcedures(), []);
  const { user } = useAuth();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Arama filtresi
  const procedures = useMemo(() => {
    if (!searchQuery.trim()) {
      return allProcedures;
    }
    const query = searchQuery.toLowerCase();
    return allProcedures.filter(proc =>
      proc.title.toLowerCase().includes(query) ||
      proc.description.toLowerCase().includes(query) ||
      (proc.keywords || []).some(k => k.toLowerCase().includes(query))
    );
  }, [allProcedures, searchQuery]);

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
        order: allProcedures.length + 1,
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
  }, [allProcedures.length]);

  const handleCancel = useCallback(() => {
    setIsAddingNew(false);
  }, []);

  // İçerik silme
  const handleDelete = useCallback(async (procId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Bu prosedürü silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    setDeletingId(procId);
    try {
      const response = await fetch(`/api/content/sections/${procId}`, {
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

        {/* Arama kutusu */}
        {!isAddingNew && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
            <Input
              type="text"
              placeholder="Prosedür ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-discord-dark border-discord-light"
            />
          </div>
        )}

        {!isAddingNew && (
          <div className="space-y-3">
            {procedures.length === 0 && searchQuery && (
              <div className="text-center py-8 text-discord-muted">
                &quot;{searchQuery}&quot; için sonuç bulunamadı.
              </div>
            )}
            {procedures.map((proc) => (
              <div key={proc.id} className="relative group">
                <Link
                  href={`/procedures/${proc.slug}` as never}
                  className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors"
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
                {/* Silme butonu - sadece ust_yetkili için */}
                {canEdit && (
                  <Button
                    onClick={(e) => handleDelete(proc.id, e)}
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-discord-red hover:bg-discord-red/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Sil"
                    disabled={deletingId === proc.id}
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
