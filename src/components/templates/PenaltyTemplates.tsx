'use client';

/**
 * PenaltyTemplates Bileşeni
 * Ceza şablonları listesi görünümü
 *
 * Requirement 8: Ceza Şablonları
 * - 8.4: WHEN a user clicks the copy button THEN THE System SHALL copy the template text to clipboard
 * - 8.5: WHEN a gm_plus edits a template THEN THE System SHALL save the changes
 * - 8.6: WHEN a non-gm_plus user views templates THEN THE System SHALL hide edit functionality
 * 
 * Requirement 12.3: WHEN a user copies a template or content THEN THE System SHALL log the copy action with content details
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Copy,
  Check,
  Edit,
  FileText,
  Ban,
  VolumeX,
  AlertTriangle,
} from 'lucide-react';
import type { PenaltyTemplate, TemplateCategory } from '@/types';

/**
 * PenaltyTemplates Props Interface
 * Tasarım dokümanına uygun interface tanımı
 */
export interface PenaltyTemplatesProps {
  /** Gösterilecek şablon listesi */
  templates: PenaltyTemplate[];
  /** Düzenleme yetkisi var mı (sadece ust_yetkili için true) */
  canEdit: boolean;
  /** Kopyalama callback'i - şablon mesajını panoya kopyalar */
  onCopy: (text: string) => void;
  /** Düzenleme callback'i - şablon düzenlendiğinde çağrılır (opsiyonel) */
  onEdit?: (template: PenaltyTemplate) => void | Promise<void>;
  /** Kullanıcı ID'si - loglama için (opsiyonel) */
  userId?: string;
}

// Kategori ikonları ve etiketleri
const categoryConfig: Record<
  TemplateCategory,
  { icon: React.ReactNode; label: string; color: string }
> = {
  ban: {
    icon: <Ban className="h-4 w-4" />,
    label: 'Ban',
    color: 'text-red-400 bg-red-400/10',
  },
  mute: {
    icon: <VolumeX className="h-4 w-4" />,
    label: 'Mute',
    color: 'text-yellow-400 bg-yellow-400/10',
  },
  warn: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Uyarı',
    color: 'text-orange-400 bg-orange-400/10',
  },
};

/**
 * PenaltyTemplates Component
 * 
 * Ceza şablonlarını kategorilere göre gruplandırarak listeler.
 * Her şablon için kopyalama butonu sunar.
 * canEdit true ise düzenleme butonu gösterir (Requirement 8.6).
 * 
 * @example
 * ```tsx
 * <PenaltyTemplates
 *   templates={templates}
 *   canEdit={user.role === 'ust_yetkili'}
 *   onCopy={(text) => navigator.clipboard.writeText(text)}
 *   onEdit={(template) => saveTemplate(template)}
 * />
 * ```
 */
export function PenaltyTemplates({
  templates,
  canEdit,
  onCopy,
  onEdit,
  userId,
}: PenaltyTemplatesProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PenaltyTemplate | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedMessage, setEditedMessage] = useState('');

  /**
   * Şablon kopyalama logunu API'ye gönder
   * Requirement 12.3: WHEN a user copies a template or content THEN THE System SHALL log the copy action with content details
   */
  const logTemplateCopy = async (template: PenaltyTemplate) => {
    try {
      await fetch('/api/logs/copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'template',
          templateId: template.id,
          templateName: template.name,
          templateCategory: template.category,
          userId: userId,
        }),
      });
    } catch (error) {
      // Loglama hatası sessizce yoksayılır - kullanıcı deneyimini etkilememeli
      console.error('Template copy log error:', error);
    }
  };

  /**
   * Kopyala işlevi
   * Requirement 8.4: WHEN a user clicks the copy button THEN THE System SHALL copy the template text to clipboard
   * Requirement 12.3: Log the copy action with content details
   */
  const handleCopy = async (template: PenaltyTemplate) => {
    // Callback'i çağır - parent component clipboard işlemini yapacak
    onCopy(template.message);
    
    // Görsel feedback için kopyalanan şablonu işaretle
    setCopiedId(template.id);

    // Kopyalama işlemini logla (Requirement 12.3)
    await logTemplateCopy(template);

    // 2 saniye sonra işareti kaldır
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  /**
   * Düzenleme başlat
   * Requirement 8.6: Sadece canEdit true ise düzenleme butonu görünür
   */
  const handleEditStart = (template: PenaltyTemplate) => {
    setEditingTemplate(template);
    setEditedName(template.name);
    setEditedMessage(template.message);
  };

  /**
   * Düzenleme kaydet
   * Requirement 8.5: WHEN an üst_yetkili edits a template THEN THE System SHALL save the changes
   */
  const handleSave = () => {
    if (!editingTemplate || !onEdit) return;

    const updatedTemplate: PenaltyTemplate = {
      ...editingTemplate,
      name: editedName,
      message: editedMessage,
      updatedAt: new Date(),
    };

    // Parent component'e güncellenmiş şablonu bildir
    onEdit(updatedTemplate);
    
    // Dialog'u kapat
    setEditingTemplate(null);
  };

  /**
   * Düzenleme iptal
   */
  const handleCancel = () => {
    setEditingTemplate(null);
    setEditedName('');
    setEditedMessage('');
  };

  // Kategoriye göre grupla
  const templatesByCategory = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<TemplateCategory, PenaltyTemplate[]>
  );

  // Kategori sıralaması
  const categoryOrder: TemplateCategory[] = ['ban', 'mute', 'warn'];
  const sortedCategories = categoryOrder.filter(
    (cat) => templatesByCategory[cat]?.length > 0
  );

  return (
    <>
      <div className="space-y-6">
        {/* Kategorilere göre şablonlar */}
        {sortedCategories.map((category) => {
          const categoryTemplates = templatesByCategory[category];
          const config = categoryConfig[category];

          return (
            <Card key={category} className="bg-discord-light border-discord-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className={`p-1.5 rounded ${config.color}`}>
                    {config.icon}
                  </span>
                  {config.label} Şablonları
                  <span className="text-sm font-normal text-discord-muted">
                    ({categoryTemplates.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 rounded-lg bg-discord-darker border border-discord-light"
                  >
                    {/* Başlık ve aksiyonlar */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-discord-accent" />
                        <span className="font-medium text-discord-text">
                          {template.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Düzenleme butonu - sadece canEdit true ise göster (Requirement 8.6) */}
                        {canEdit && onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStart(template)}
                            className="h-8 w-8 p-0 hover:bg-discord-light"
                            title="Şablonu düzenle"
                            aria-label={`${template.name} şablonunu düzenle`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Kopyala butonu - tüm kullanıcılar için (Requirement 8.4) */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(template)}
                          className="h-8 w-8 p-0 hover:bg-discord-light"
                          title="Şablonu kopyala"
                          aria-label={`${template.name} şablonunu kopyala`}
                        >
                          {copiedId === template.id ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Mesaj içeriği */}
                    <p className="text-sm text-discord-muted bg-discord-dark p-3 rounded border border-discord-light whitespace-pre-wrap">
                      {template.message}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* Boş durum */}
        {templates.length === 0 && (
          <Card className="bg-discord-light border-discord-lighter">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-discord-muted mb-4" />
              <p className="text-discord-text font-medium">Şablon bulunamadı</p>
              <p className="text-sm text-discord-muted">
                Henüz ceza şablonu eklenmemiş
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Düzenleme Dialog - Requirement 8.5 */}
      <Dialog
        open={!!editingTemplate}
        onOpenChange={(open) => !open && handleCancel()}
      >
        <DialogContent className="bg-discord-dark border-discord-light">
          <DialogHeader>
            <DialogTitle className="text-discord-text">Şablon Düzenle</DialogTitle>
            <DialogDescription className="text-discord-muted">
              Şablon içeriğini düzenleyin. Değişiklikler kaydedildiğinde tüm
              kullanıcılar güncel şablonu görecektir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                htmlFor="template-name"
                className="text-sm font-medium text-discord-text"
              >
                Şablon Adı
              </label>
              <Input
                id="template-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="bg-discord-darker border-discord-light text-discord-text"
                placeholder="Şablon adı"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="template-message"
                className="text-sm font-medium text-discord-text"
              >
                Mesaj İçeriği
              </label>
              <Textarea
                id="template-message"
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                className="bg-discord-darker border-discord-light text-discord-text min-h-32"
                placeholder="Şablon mesajı"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-discord-light"
            >
              İptal
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editedName.trim() || !editedMessage.trim()}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PenaltyTemplates;
