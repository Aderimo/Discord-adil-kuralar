'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useParams, notFound } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { ContentEditor } from '@/components/content/ContentEditor';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadCommands } from '@/lib/content';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit3, Plus, Trash2, Search, Gavel, Info, Mic, Shield } from 'lucide-react';
import type { CommandCategory, CommandDefinition, GuideContent, PenaltyDefinition, ProcedureDefinition } from '@/types/content';

const categoryConfig: Record<CommandCategory, { 
  label: string; 
  description: string;
  icon: React.ReactNode; 
  color: string;
  requiredRole: string;
}> = {
  ceza: { 
    label: 'Ceza Komutları', 
    description: 'Mute, timeout, temprole ve diğer ceza komutları.',
    icon: <Gavel className="h-6 w-6" />,
    color: 'text-discord-red',
    requiredRole: 'reg'
  },
  bilgi: { 
    label: 'Bilgi Komutları', 
    description: 'Kullanıcı bilgisi, sicil ve geçmiş sorgulama.',
    icon: <Info className="h-6 w-6" />,
    color: 'text-discord-accent',
    requiredRole: 'reg'
  },
  sesli: { 
    label: 'Sesli Kanal Komutları', 
    description: 'Voice channel yönetimi ve kullanıcı çekme.',
    icon: <Mic className="h-6 w-6" />,
    color: 'text-discord-green',
    requiredRole: 'reg'
  },
  'gk-plus': { 
    label: 'GK+ Komutları', 
    description: 'Genel Koordinatör ve üstü için ban/unban komutları.',
    icon: <Shield className="h-6 w-6" />,
    color: 'text-discord-yellow',
    requiredRole: 'gk'
  },
};

export default function CommandCategoryPage(): React.ReactElement {
  const params = useParams();
  const category = params.category as CommandCategory;
  const { user } = useAuth();
  const [editingCommand, setEditingCommand] = useState<CommandDefinition | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const validCategories: CommandCategory[] = ['ceza', 'bilgi', 'sesli', 'gk-plus'];
  
  if (!validCategories.includes(category)) {
    notFound();
  }

  const config = categoryConfig[category];

  const allCommands = useMemo(() => loadCommands(), []);
  const commands = useMemo(() => {
    let filtered = allCommands.filter(cmd => (cmd.category || 'bilgi') === category);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cmd => 
        cmd.command.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query) ||
        (cmd.keywords || []).some(k => k.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allCommands, category, searchQuery]);

  const canEdit = user?.role && hasRole(user.role, 'gm_plus');

  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Komutlar', href: '/commands' },
    { label: config.label, href: `/commands/${category}` },
  ], [category, config.label]);

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

      window.location.reload();
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      throw error;
    }
  }, [editingCommand?.id]);

  const handleAddNew = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      const commandContent = content as CommandDefinition;
      const newId = `cmd-${Date.now()}`;
      const newContent = {
        ...commandContent,
        id: newId,
        category: category,
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

      window.location.reload();
    } catch (error) {
      console.error('Ekleme hatası:', error);
      throw error;
    }
  }, [category]);

  const handleCancel = useCallback(() => {
    setEditingCommand(null);
    setIsAddingNew(false);
  }, []);

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/commands" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-lg bg-discord-dark ${config.color}`}>
              {config.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-discord-text mb-1">
                {config.label}
              </h1>
              <p className="text-discord-muted">
                {config.description}
              </p>
              {config.requiredRole !== 'mod' && (
                <span className="inline-block mt-2 text-xs bg-discord-yellow/20 px-2 py-1 rounded text-discord-yellow">
                  {config.requiredRole === 'admin' ? 'GK ve üstü gerekli' : config.requiredRole}
                </span>
              )}
            </div>
          </div>
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
