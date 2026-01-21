'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ContentEditor } from '@/components/content/ContentEditor';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadCommands } from '@/lib/content';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Edit3, Plus } from 'lucide-react';
import type { CommandDefinition, GuideContent, PenaltyDefinition, ProcedureDefinition } from '@/types/content';

export default function CommandsPage(): React.ReactElement {
  const commands = useMemo(() => loadCommands(), []);
  const { user } = useAuth();
  const [editingCommand, setEditingCommand] = useState<CommandDefinition | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Sadece ust_yetkili rolü düzenleme yapabilir
  const canEdit = user?.role && hasRole(user.role, 'ust_yetkili');

  // Breadcrumb öğeleri
  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Komutlar', href: '/commands' },
  ], []);

  // İçerik kaydetme (düzenleme)
  const handleSave = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      const response = await fetch(`/api/content/sections/${editingCommand?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'command',
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
  }, [editingCommand?.id]);

  // Yeni içerik ekleme
  const handleAddNew = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      const commandContent = content as CommandDefinition;
      const newId = `cmd-${Date.now()}`;
      const newContent = {
        ...commandContent,
        id: newId,
      };

      const response = await fetch('/api/content/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'command',
          data: newContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'İçerik eklenemedi');
      }

      // Sayfayı yenile
      window.location.reload();
    } catch (error) {
      console.error('Ekleme hatası:', error);
      throw error;
    }
  }, []);

  // Düzenlemeyi iptal et
  const handleCancel = useCallback(() => {
    setEditingCommand(null);
    setIsAddingNew(false);
  }, []);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigasyon bileşenleri */}
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-discord-text mb-2">
              Moderasyon Komutları
            </h1>
            <p className="text-discord-muted">
              Tüm moderasyon komutları ve kullanım örnekleri.
            </p>
          </div>
          {/* Yeni Ekle butonu - sadece ust_yetkili için */}
          {canEdit && !editingCommand && !isAddingNew && (
            <Button
              onClick={() => setIsAddingNew(true)}
              className="gap-2 bg-discord-green hover:bg-discord-green/90"
            >
              <Plus className="h-4 w-4" />
              Yeni Komut Ekle
            </Button>
          )}
        </div>

        {/* Yeni ekleme modu */}
        {isAddingNew && (
          <div className="mb-6">
            <ContentEditor
              type="command"
              content={null}
              onSave={handleAddNew}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* Düzenleme modu */}
        {editingCommand && !isAddingNew && (
          <div className="mb-6">
            <ContentEditor
              type="command"
              content={editingCommand}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* Komut listesi */}
        {!editingCommand && !isAddingNew && (
          <div className="space-y-4">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                id={cmd.id}
                className="bg-discord-dark border border-discord-light rounded-lg p-4 space-y-3 scroll-mt-20"
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-mono font-semibold text-discord-accent">
                    {cmd.command}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-wrap">
                      {cmd.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-0.5 bg-discord-lighter text-discord-muted text-xs rounded"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                    {/* Düzenleme butonu - sadece ust_yetkili için */}
                    {canEdit && (
                      <Button
                        onClick={() => setEditingCommand(cmd)}
                        variant="ghost"
                        size="sm"
                        className="text-discord-accent hover:bg-discord-accent/10"
                        title="Düzenle"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-discord-muted text-sm">
                  {cmd.description}
                </p>

                <div className="bg-discord-darker rounded p-3">
                  <h4 className="text-xs font-medium text-discord-muted mb-1">Kullanım:</h4>
                  <code className="text-sm text-discord-text font-mono">
                    {cmd.usage}
                  </code>
                </div>

                {cmd.examples.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-discord-text mb-2">Örnekler:</h4>
                    <div className="space-y-1">
                      {cmd.examples.map((example, i) => (
                        <code
                          key={i}
                          className="block text-sm text-discord-muted font-mono bg-discord-darker rounded px-2 py-1"
                        >
                          {example}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
