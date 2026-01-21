'use client';

/**
 * ContentEditor Bileşeni
 * 
 * Markdown editör arayüzü, önizleme modu ve kaydet/iptal butonları
 * Sadece ust_yetkili rolüne görünür (parent component tarafından kontrol edilir)
 * 
 * Requirements: 11.2, 11.3
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  X, 
  Eye, 
  Edit3, 
  AlertCircle,
  Loader2 
} from 'lucide-react';
import type {
  GuideContent,
  PenaltyDefinition,
  CommandDefinition,
  ProcedureDefinition,
  PenaltyCategory,
} from '@/types/content';

// İçerik tipi
export type ContentType = 'guide' | 'penalty' | 'command' | 'procedure';

// ContentEditor props
export interface ContentEditorProps {
  /** İçerik tipi */
  type: ContentType;
  /** Mevcut içerik (düzenleme için) veya null (yeni ekleme için) */
  content?: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition | null;
  /** Kaydetme callback */
  onSave: (content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition) => Promise<void>;
  /** İptal callback */
  onCancel: () => void;
}

// Basit markdown parser (ContentViewer'dan alındı)
function parseMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-discord-text mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-discord-text mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-discord-text mt-8 mb-4">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-discord-text font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-discord-darker px-1.5 py-0.5 rounded text-sm font-mono text-discord-accent">$1</code>');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre class="bg-discord-darker rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm font-mono text-discord-text">${code.trim()}</code></pre>`;
  });

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-discord-accent pl-4 my-4 text-discord-muted italic">$1</blockquote>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-discord-text">$1</li>');
  html = html.replace(/^\* (.+)$/gm, '<li class="ml-4 list-disc text-discord-text">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-discord-text">$1</li>');

  // Wrap consecutive list items
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => {
    return `<ul class="my-4 space-y-2">${match}</ul>`;
  });

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="my-6 border-discord-light" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-discord-accent hover:underline">$1</a>');

  // Paragraphs
  html = html.split('\n\n').map(block => {
    if (block.trim() && !block.startsWith('<')) {
      return `<p class="text-discord-text leading-relaxed mb-4">${block}</p>`;
    }
    return block;
  }).join('\n');

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  return html;
}

// Ceza kategorisi seçenekleri
const PENALTY_CATEGORIES: { value: PenaltyCategory; label: string }[] = [
  { value: 'yazili', label: 'Yazılı' },
  { value: 'sesli', label: 'Sesli' },
  { value: 'ekstra', label: 'Ekstra' },
  { value: 'marked', label: 'Marked' },
  { value: 'blacklist', label: 'Blacklist' },
];

// Guide Editor
function GuideEditor({
  content,
  onChange,
}: {
  content: Partial<GuideContent>;
  onChange: (content: Partial<GuideContent>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Başlık</Label>
          <Input
            id="title"
            value={content.title || ''}
            onChange={(e) => onChange({ ...content, title: e.target.value })}
            placeholder="İçerik başlığı"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input
            id="slug"
            value={content.slug || ''}
            onChange={(e) => onChange({ ...content, slug: e.target.value })}
            placeholder="url-dostu-slug"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="keywords">Anahtar Kelimeler (virgülle ayırın)</Label>
        <Input
          id="keywords"
          value={content.keywords?.join(', ') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) 
          })}
          placeholder="anahtar, kelime, örnek"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">İçerik (Markdown)</Label>
        <Textarea
          id="content"
          value={content.content || ''}
          onChange={(e) => onChange({ ...content, content: e.target.value })}
          placeholder="Markdown formatında içerik yazın..."
          className="min-h-[300px] font-mono text-sm"
        />
      </div>
    </div>
  );
}

// Penalty Editor
function PenaltyEditor({
  content,
  onChange,
}: {
  content: Partial<PenaltyDefinition>;
  onChange: (content: Partial<PenaltyDefinition>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="code">Ceza Kodu</Label>
          <Input
            id="code"
            value={content.code || ''}
            onChange={(e) => onChange({ ...content, code: e.target.value })}
            placeholder="ADK-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Ceza Adı</Label>
          <Input
            id="name"
            value={content.name || ''}
            onChange={(e) => onChange({ ...content, name: e.target.value })}
            placeholder="Ceza adı"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategori</Label>
          <select
            id="category"
            value={content.category || 'yazili'}
            onChange={(e) => onChange({ ...content, category: e.target.value as PenaltyCategory })}
            className="flex h-9 w-full rounded-md border border-discord-light bg-discord-dark px-3 py-1 text-sm text-discord-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-discord-accent"
          >
            {PENALTY_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="duration">Süre</Label>
          <Input
            id="duration"
            value={content.duration || ''}
            onChange={(e) => onChange({ ...content, duration: e.target.value })}
            placeholder="7 gün, kalıcı, vb."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="keywords">Anahtar Kelimeler</Label>
          <Input
            id="keywords"
            value={content.keywords?.join(', ') || ''}
            onChange={(e) => onChange({ 
              ...content, 
              keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) 
            })}
            placeholder="anahtar, kelime"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={content.description || ''}
          onChange={(e) => onChange({ ...content, description: e.target.value })}
          placeholder="Ceza açıklaması"
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conditions">Koşullar (her satır bir koşul)</Label>
        <Textarea
          id="conditions"
          value={content.conditions?.join('\n') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            conditions: e.target.value.split('\n').filter(Boolean) 
          })}
          placeholder="Her satıra bir koşul yazın"
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="alternatives">Alternatifler (her satır bir alternatif)</Label>
        <Textarea
          id="alternatives"
          value={content.alternatives?.join('\n') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            alternatives: e.target.value.split('\n').filter(Boolean) 
          })}
          placeholder="Her satıra bir alternatif yazın"
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="examples">Örnekler (her satır bir örnek)</Label>
        <Textarea
          id="examples"
          value={content.examples?.join('\n') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            examples: e.target.value.split('\n').filter(Boolean) 
          })}
          placeholder="Her satıra bir örnek yazın"
          className="min-h-[100px]"
        />
      </div>
    </div>
  );
}


// Command Editor
function CommandEditor({
  content,
  onChange,
}: {
  content: Partial<CommandDefinition>;
  onChange: (content: Partial<CommandDefinition>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="command">Komut</Label>
          <Input
            id="command"
            value={content.command || ''}
            onChange={(e) => onChange({ ...content, command: e.target.value })}
            placeholder="/mute, /ban, vb."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage">Kullanım</Label>
          <Input
            id="usage"
            value={content.usage || ''}
            onChange={(e) => onChange({ ...content, usage: e.target.value })}
            placeholder="/mute @kullanıcı [süre] [sebep]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={content.description || ''}
          onChange={(e) => onChange({ ...content, description: e.target.value })}
          placeholder="Komut açıklaması"
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="permissions">Gerekli Yetkiler (virgülle ayırın)</Label>
        <Input
          id="permissions"
          value={content.permissions?.join(', ') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            permissions: e.target.value.split(',').map(p => p.trim()).filter(Boolean) 
          })}
          placeholder="mod, admin, ust_yetkili"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="keywords">Anahtar Kelimeler (virgülle ayırın)</Label>
        <Input
          id="keywords"
          value={content.keywords?.join(', ') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) 
          })}
          placeholder="anahtar, kelime"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="examples">Örnekler (her satır bir örnek)</Label>
        <Textarea
          id="examples"
          value={content.examples?.join('\n') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            examples: e.target.value.split('\n').filter(Boolean) 
          })}
          placeholder="Her satıra bir örnek yazın"
          className="min-h-[100px]"
        />
      </div>
    </div>
  );
}

// Procedure Editor
function ProcedureEditor({
  content,
  onChange,
}: {
  content: Partial<ProcedureDefinition>;
  onChange: (content: Partial<ProcedureDefinition>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Başlık</Label>
          <Input
            id="title"
            value={content.title || ''}
            onChange={(e) => onChange({ ...content, title: e.target.value })}
            placeholder="Prosedür başlığı"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input
            id="slug"
            value={content.slug || ''}
            onChange={(e) => onChange({ ...content, slug: e.target.value })}
            placeholder="url-dostu-slug"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={content.description || ''}
          onChange={(e) => onChange({ ...content, description: e.target.value })}
          placeholder="Prosedür açıklaması"
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="requiredPermissions">Gerekli Yetkiler (virgülle ayırın)</Label>
        <Input
          id="requiredPermissions"
          value={content.requiredPermissions?.join(', ') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            requiredPermissions: e.target.value.split(',').map(p => p.trim()).filter(Boolean) 
          })}
          placeholder="mod, admin, ust_yetkili"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="steps">Adımlar (Markdown)</Label>
        <Textarea
          id="steps"
          value={content.steps || ''}
          onChange={(e) => onChange({ ...content, steps: e.target.value })}
          placeholder="Markdown formatında adımları yazın..."
          className="min-h-[200px] font-mono text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="relatedCommands">İlgili Komutlar (virgülle ayırın)</Label>
          <Input
            id="relatedCommands"
            value={content.relatedCommands?.join(', ') || ''}
            onChange={(e) => onChange({ 
              ...content, 
              relatedCommands: e.target.value.split(',').map(c => c.trim()).filter(Boolean) 
            })}
            placeholder="/mute, /ban"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="relatedPenalties">İlgili Cezalar (virgülle ayırın)</Label>
          <Input
            id="relatedPenalties"
            value={content.relatedPenalties?.join(', ') || ''}
            onChange={(e) => onChange({ 
              ...content, 
              relatedPenalties: e.target.value.split(',').map(p => p.trim()).filter(Boolean) 
            })}
            placeholder="ADK-001, HAK-002"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="keywords">Anahtar Kelimeler (virgülle ayırın)</Label>
        <Input
          id="keywords"
          value={content.keywords?.join(', ') || ''}
          onChange={(e) => onChange({ 
            ...content, 
            keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) 
          })}
          placeholder="anahtar, kelime"
        />
      </div>
    </div>
  );
}

// İçerik tipi başlıkları
const TYPE_LABELS: Record<ContentType, string> = {
  guide: 'Kılavuz',
  penalty: 'Ceza',
  command: 'Komut',
  procedure: 'Prosedür',
};

// Ana ContentEditor bileşeni
export function ContentEditor({
  type,
  content,
  onSave,
  onCancel,
}: ContentEditorProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state - içerik tipine göre başlangıç değerleri
  const [formData, setFormData] = useState<
    Partial<GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition>
  >(() => {
    if (content) {
      return { ...content };
    }
    
    // Yeni içerik için varsayılan değerler
    switch (type) {
      case 'guide':
        return {
          id: '',
          title: '',
          slug: '',
          category: 'kilavuz',
          content: '',
          keywords: [],
          relatedArticles: [],
          order: 0,
        } as Partial<GuideContent>;
      case 'penalty':
        return {
          id: '',
          code: '',
          name: '',
          category: 'yazili',
          duration: '',
          description: '',
          conditions: [],
          alternatives: [],
          examples: [],
          keywords: [],
          order: 0,
        } as Partial<PenaltyDefinition>;
      case 'command':
        return {
          id: '',
          command: '',
          description: '',
          usage: '',
          permissions: [],
          examples: [],
          keywords: [],
          order: 0,
        } as Partial<CommandDefinition>;
      case 'procedure':
        return {
          id: '',
          title: '',
          slug: '',
          description: '',
          steps: '',
          requiredPermissions: [],
          relatedCommands: [],
          relatedPenalties: [],
          keywords: [],
          order: 0,
        } as Partial<ProcedureDefinition>;
      default:
        return {};
    }
  });

  // Önizleme içeriği oluştur
  const previewHtml = useMemo(() => {
    switch (type) {
      case 'guide':
        return parseMarkdown((formData as Partial<GuideContent>).content || '');
      case 'penalty': {
        const penalty = formData as Partial<PenaltyDefinition>;
        return `
          <div class="mb-4">
            <span class="bg-discord-accent/20 text-discord-accent px-2 py-1 rounded text-sm font-mono">${penalty.code || 'KOD'}</span>
            <span class="ml-2 text-xs text-discord-muted uppercase">${penalty.category || 'kategori'}</span>
          </div>
          <h1 class="text-2xl font-bold text-discord-text mb-4">${penalty.name || 'Ceza Adı'}</h1>
          <div class="bg-discord-light rounded-lg p-4 mb-4">
            <span class="text-discord-muted text-sm">Süre: </span>
            <span class="text-discord-accent font-semibold">${penalty.duration || '-'}</span>
          </div>
          <p class="text-discord-text mb-4">${penalty.description || ''}</p>
          ${penalty.conditions?.length ? `
            <h2 class="text-lg font-semibold text-discord-text mb-2">Koşullar</h2>
            <ul class="list-disc ml-4 mb-4">${penalty.conditions.map(c => `<li class="text-discord-text">${c}</li>`).join('')}</ul>
          ` : ''}
          ${penalty.examples?.length ? `
            <h2 class="text-lg font-semibold text-discord-text mb-2">Örnekler</h2>
            <div class="space-y-2">${penalty.examples.map(e => `<div class="bg-discord-darker rounded p-2 text-discord-muted text-sm">${e}</div>`).join('')}</div>
          ` : ''}
        `;
      }
      case 'command': {
        const cmd = formData as Partial<CommandDefinition>;
        return `
          <h1 class="text-2xl font-bold text-discord-accent font-mono mb-2">${cmd.command || '/komut'}</h1>
          <p class="text-discord-text mb-4">${cmd.description || ''}</p>
          <div class="bg-discord-light rounded-lg p-4 mb-4">
            <span class="text-discord-muted text-sm">Kullanım: </span>
            <code class="text-discord-accent font-mono">${cmd.usage || ''}</code>
          </div>
          ${cmd.permissions?.length ? `
            <h2 class="text-lg font-semibold text-discord-text mb-2">Gerekli Yetkiler</h2>
            <div class="flex flex-wrap gap-2 mb-4">${cmd.permissions.map(p => `<span class="bg-discord-darker px-2 py-1 rounded text-sm text-discord-muted">${p}</span>`).join('')}</div>
          ` : ''}
          ${cmd.examples?.length ? `
            <h2 class="text-lg font-semibold text-discord-text mb-2">Örnekler</h2>
            <div class="space-y-2">${cmd.examples.map(e => `<div class="bg-discord-darker rounded p-2 font-mono text-sm text-discord-text">${e}</div>`).join('')}</div>
          ` : ''}
        `;
      }
      case 'procedure': {
        const proc = formData as Partial<ProcedureDefinition>;
        return `
          <h1 class="text-2xl font-bold text-discord-text mb-2">${proc.title || 'Prosedür Başlığı'}</h1>
          <p class="text-discord-muted mb-4">${proc.description || ''}</p>
          ${proc.requiredPermissions?.length ? `
            <div class="bg-discord-light rounded-lg p-4 mb-4">
              <span class="text-discord-muted text-sm">Gerekli Yetkiler: </span>
              ${proc.requiredPermissions.map(p => `<span class="bg-discord-darker px-2 py-1 rounded text-sm text-discord-accent ml-1">${p}</span>`).join('')}
            </div>
          ` : ''}
          <h2 class="text-lg font-semibold text-discord-text mb-2">Adımlar</h2>
          <div class="prose-discord">${parseMarkdown(proc.steps || '')}</div>
        `;
      }
      default:
        return '<p class="text-discord-muted">Önizleme mevcut değil.</p>';
    }
  }, [type, formData]);

  // Validasyon
  const validateForm = useCallback((): string | null => {
    switch (type) {
      case 'guide': {
        const guide = formData as Partial<GuideContent>;
        if (!guide.title?.trim()) return 'Başlık gereklidir';
        if (!guide.content?.trim()) return 'İçerik gereklidir';
        break;
      }
      case 'penalty': {
        const penalty = formData as Partial<PenaltyDefinition>;
        if (!penalty.code?.trim()) return 'Ceza kodu gereklidir';
        if (!penalty.name?.trim()) return 'Ceza adı gereklidir';
        if (!penalty.duration?.trim()) return 'Süre gereklidir';
        break;
      }
      case 'command': {
        const cmd = formData as Partial<CommandDefinition>;
        if (!cmd.command?.trim()) return 'Komut gereklidir';
        if (!cmd.description?.trim()) return 'Açıklama gereklidir';
        break;
      }
      case 'procedure': {
        const proc = formData as Partial<ProcedureDefinition>;
        if (!proc.title?.trim()) return 'Başlık gereklidir';
        if (!proc.steps?.trim()) return 'Adımlar gereklidir';
        break;
      }
    }
    return null;
  }, [type, formData]);

  // Kaydet
  const handleSave = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await onSave(formData as GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydetme sırasında bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  }, [formData, onSave, validateForm]);

  // Form değişikliği
  const handleFormChange = useCallback((newData: Partial<typeof formData>) => {
    setFormData(newData);
    setError(null);
  }, []);

  const isNewContent = !content;
  const title = isNewContent 
    ? `Yeni ${TYPE_LABELS[type]} Ekle` 
    : `${TYPE_LABELS[type]} Düzenle`;

  return (
    <Card className="bg-discord-darker border-discord-light">
      <CardHeader className="border-b border-discord-light">
        <div className="flex items-center justify-between">
          <CardTitle className="text-discord-text">{title}</CardTitle>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
            <TabsList className="bg-discord-dark">
              <TabsTrigger value="edit" className="gap-2">
                <Edit3 className="h-4 w-4" />
                <span className="hidden sm:inline">Düzenle</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Önizleme</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Hata mesajı */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-discord-red/10 border border-discord-red/20 p-3 text-discord-red">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Düzenleme / Önizleme */}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="edit" className="mt-0">
            {type === 'guide' && (
              <GuideEditor
                content={formData as Partial<GuideContent>}
                onChange={handleFormChange}
              />
            )}
            {type === 'penalty' && (
              <PenaltyEditor
                content={formData as Partial<PenaltyDefinition>}
                onChange={handleFormChange}
              />
            )}
            {type === 'command' && (
              <CommandEditor
                content={formData as Partial<CommandDefinition>}
                onChange={handleFormChange}
              />
            )}
            {type === 'procedure' && (
              <ProcedureEditor
                content={formData as Partial<ProcedureDefinition>}
                onChange={handleFormChange}
              />
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-0">
            <div className="rounded-lg border border-discord-light bg-discord-light p-6 min-h-[300px]">
              <article
                className="prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Butonlar */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-discord-light pt-4">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
            className="text-discord-muted hover:text-discord-text"
          >
            <X className="h-4 w-4 mr-2" />
            İptal
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-discord-accent hover:bg-discord-accent/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Kaydet
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ContentEditor;
