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
import { Edit3, Plus, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CommandDefinition, GuideContent, PenaltyDefinition, ProcedureDefinition } from '@/types/content';

export default function CommandsPage(): React.ReactElement {
  const allCommands = useMemo(() => loadCommands(), []);
  const { user } = useAuth();
  const [editingCommand, setEditingCommand] = useState<CommandDefinition | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Arama filtresi
  const commands = useMemo(() => {
    if (!searchQuery.trim()) {
      return allCommands;
    }
    const query = searchQuery.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.command.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      (cmd.keywords || []).some(k => k.toLowerCase().includes(query))
    );
  }, [allCommands, searchQuery]);

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

  // İçerik silme
  const handleDelete = useCallback(async (commandId: string) => {
    if (!confirm('Bu komutu silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    setDeletingId(commandId);
    try {
      const response = await fetch(`/api/content/sections/${commandId}`, {
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

        {/* Arama kutusu */}
        {!editingCommand && !isAddingNew && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
            <Input
              type="text"
              placeholder="Komut ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-discord-dark border-discord-light"
            />
          </div>
        )}

        {/* Komut listesi */}
        {!editingCommand && !isAddingNew && (
          <div className="space-y-4">
            {commands.length === 0 && searchQuery && (
              <div className="text-center py-8 text-discord-muted">
                &quot;{searchQuery}&quot; için sonuç bulunamadı.
              </div>
            )}
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
                    {/* Düzenleme ve silme butonları - sadece ust_yetkili için */}
                    {canEdit && (
                      <>
                        <Button
                          onClick={() => setEditingCommand(cmd)}
                          variant="ghost"
                          size="sm"
                          className="text-discord-accent hover:bg-discord-accent/10"
                          title="Düzenle"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(cmd.id)}
                          variant="ghost"
                          size="sm"
                          className="text-discord-red hover:bg-discord-red/10"
                          title="Sil"
                          disabled={deletingId === cmd.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
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
