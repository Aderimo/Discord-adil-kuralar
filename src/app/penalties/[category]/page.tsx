'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useParams, notFound } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { ContentEditor } from '@/components/content/ContentEditor';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadPenalties } from '@/lib/content';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit3, Plus, Trash2, Search } from 'lucide-react';
import type { PenaltyCategory, PenaltyDefinition, GuideContent, CommandDefinition, ProcedureDefinition } from '@/types/content';

const categoryLabels: Record<PenaltyCategory, string> = {
  yazili: 'Yazılı Cezalar',
  sesli: 'Sesli Cezalar',
  ekstra: 'Ekstra Cezalar',
  marked: 'Marked (İzleme Listesi)',
  blacklist: 'Blacklist (Kara Liste)',
};

const categoryDescriptions: Record<PenaltyCategory, string> = {
  yazili: 'Yazılı kanallardaki ihlaller için uygulanan cezalar.',
  sesli: 'Sesli kanallardaki ihlaller için uygulanan cezalar.',
  ekstra: 'Özel durumlar ve ağır ihlaller için uygulanan cezalar.',
  marked: 'İzleme altına alınan kullanıcılar için uygulanan işaretlemeler.',
  blacklist: 'En ağır ihlaller için uygulanan kalıcı yasaklar.',
};

export default function PenaltyCategoryPage(): React.ReactElement {
  const params = useParams();
  const category = params.category as PenaltyCategory;
  const { user } = useAuth();
  const [editingPenalty, setEditingPenalty] = useState<PenaltyDefinition | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const validCategories: PenaltyCategory[] = ['yazili', 'sesli', 'ekstra', 'marked', 'blacklist'];
  
  if (!validCategories.includes(category)) {
    notFound();
  }

  const allPenalties = useMemo(() => loadPenalties(), []);
  const penalties = useMemo(() => {
    let filtered = allPenalties.filter(p => p.category === category);
    
    // Arama filtresi
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        (p.keywords || []).some(k => k.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allPenalties, category, searchQuery]);

  // Sadece gm_plus ve owner rolü düzenleme yapabilir
  const canEdit = user?.role && hasRole(user.role, 'gm_plus');

  // Breadcrumb öğeleri
  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Cezalar', href: '/penalties' },
    { label: categoryLabels[category] || category, href: `/penalties/${category}` },
  ], [category]);

  // İçerik silme
  const handleDelete = useCallback(async (penaltyId: string) => {
    if (!confirm('Bu cezayı silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    setDeletingId(penaltyId);
    try {
      const response = await fetch(`/api/content/sections/${penaltyId}`, {
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

  // İçerik kaydetme (düzenleme)
  const handleSave = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      const response = await fetch(`/api/content/sections/${editingPenalty?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'penalty',
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
  }, [editingPenalty?.id]);

  // Yeni içerik ekleme
  const handleAddNew = useCallback(async (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => {
    try {
      // Yeni ID oluştur
      const penaltyContent = content as PenaltyDefinition;
      const newId = `penalty-${Date.now()}`;
      const newContent = {
        ...penaltyContent,
        id: newId,
        category: category, // Mevcut kategoriyi kullan
      };

      const response = await fetch('/api/content/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'penalty',
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
  }, [category]);

  // Düzenlemeyi iptal et
  const handleCancel = useCallback(() => {
    setEditingPenalty(null);
    setIsAddingNew(false);
  }, []);

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigasyon bileşenleri */}
        <div className="space-y-3">
          <BackButton fallbackUrl="/penalties" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-discord-text mb-2">
              {categoryLabels[category]}
            </h1>
            <p className="text-discord-muted">
              {categoryDescriptions[category]}
            </p>
          </div>
          {/* Yeni Ekle butonu - sadece gm_plus için */}
          {canEdit && !editingPenalty && !isAddingNew && (
            <Button
              onClick={() => setIsAddingNew(true)}
              className="gap-2 bg-discord-green hover:bg-discord-green/90"
            >
              <Plus className="h-4 w-4" />
              Yeni Ceza Ekle
            </Button>
          )}
        </div>

        {/* Yeni ekleme modu */}
        {isAddingNew && (
          <div className="mb-6">
            <ContentEditor
              type="penalty"
              content={null}
              onSave={handleAddNew}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* Düzenleme modu */}
        {editingPenalty && !isAddingNew && (
          <div className="mb-6">
            <ContentEditor
              type="penalty"
              content={editingPenalty}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* Arama kutusu */}
        {!editingPenalty && !isAddingNew && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
            <Input
              type="text"
              placeholder="Ceza ara (isim, kod, açıklama)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-discord-dark border-discord-light"
            />
          </div>
        )}

        {/* Ceza listesi */}
        {!editingPenalty && !isAddingNew && (
          <div className="space-y-4">
            {penalties.length === 0 && searchQuery && (
              <div className="text-center py-8 text-discord-muted">
                &quot;{searchQuery}&quot; için sonuç bulunamadı.
              </div>
            )}
            {penalties.map((penalty) => (
              <div
                key={penalty.id}
                className="bg-discord-dark border border-discord-light rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-discord-text">
                      {penalty.name}
                    </h3>
                    <span className="text-sm text-discord-accent font-mono">
                      {penalty.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-discord-red/20 text-discord-red text-sm rounded-full">
                      {penalty.duration}
                    </span>
                    {/* Düzenleme ve silme butonları - sadece gm_plus için */}
                    {canEdit && (
                      <>
                        <Button
                          onClick={() => setEditingPenalty(penalty)}
                          variant="ghost"
                          size="sm"
                          className="text-discord-accent hover:bg-discord-accent/10"
                          title="Düzenle"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(penalty.id)}
                          variant="ghost"
                          size="sm"
                          className="text-discord-red hover:bg-discord-red/10"
                          title="Sil"
                          disabled={deletingId === penalty.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-discord-muted text-sm">
                  {penalty.description}
                </p>

                {penalty.conditions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-discord-text mb-1">Koşullar:</h4>
                    <ul className="list-disc list-inside text-sm text-discord-muted space-y-1">
                      {penalty.conditions.map((condition, i) => (
                        <li key={i}>{condition}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {penalty.examples.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-discord-text mb-1">Örnekler:</h4>
                    <ul className="list-disc list-inside text-sm text-discord-muted space-y-1">
                      {penalty.examples.map((example, i) => (
                        <li key={i}>{example}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {penalty.alternatives && penalty.alternatives.length > 0 && (
                  <div className="pt-2 border-t border-discord-light">
                    <h4 className="text-sm font-medium text-discord-yellow mb-1">Alternatifler:</h4>
                    <ul className="list-disc list-inside text-sm text-discord-muted space-y-1">
                      {penalty.alternatives.map((alt, i) => (
                        <li key={i}>{alt}</li>
                      ))}
                    </ul>
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
