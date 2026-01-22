'use client';

/**
 * ContentViewer Bileşeni
 * 
 * Markdown içerik render, arama terimlerini vurgulama ve bölümler arası navigasyon
 * 
 * Requirements: 4.2
 */

import React, { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import type {
  GuideContent,
  PenaltyDefinition,
  CommandDefinition,
  ProcedureDefinition,
} from '@/types/content';

// İçerik tipi
export type ContentType = 'guide' | 'penalty' | 'command' | 'procedure';

// ContentViewer props
export interface ContentViewerProps {
  /** İçerik tipi */
  type: ContentType;
  /** İçerik verisi */
  content: GuideContent | PenaltyDefinition | CommandDefinition | ProcedureDefinition;
  /** Vurgulanacak arama terimleri */
  highlightTerms?: string[] | undefined;
  /** Önceki içerik (navigasyon için) */
  prevContent?: { title: string; href: string } | null | undefined;
  /** Sonraki içerik (navigasyon için) */
  nextContent?: { title: string; href: string } | null | undefined;
  /** Navigasyon callback */
  onNavigate?: ((href: string) => void) | undefined;
  /** Kullanıcı ID'si - loglama için (opsiyonel) */
  userId?: string | undefined;
}

// Basit markdown parser
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
  html = html.replace(/__(.+?)__/g, '<strong class="text-discord-text font-semibold">$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>');

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

  // Paragraphs - wrap remaining text
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

// Arama terimlerini vurgula
function highlightSearchTerms(html: string, terms: string[]): string {
  if (!terms || terms.length === 0) {
    return html;
  }

  let result = html;
  terms.forEach((term) => {
    if (term.trim()) {
      // HTML tag'leri içinde vurgulama yapma
      const regex = new RegExp(`(?![^<]*>)(${escapeRegExp(term)})`, 'gi');
      result = result.replace(regex, '<mark class="bg-discord-yellow/30 text-discord-text px-0.5 rounded">$1</mark>');
    }
  });

  return result;
}

// Regex özel karakterlerini escape et
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Guide içerik render
function renderGuideContent(content: GuideContent, highlightTerms?: string[]): string {
  let html = parseMarkdown(content.content);
  if (highlightTerms) {
    html = highlightSearchTerms(html, highlightTerms);
  }
  return html;
}


// Penalty içerik render
function renderPenaltyContent(penalty: PenaltyDefinition, highlightTerms?: string[]): string {
  const sections = [
    `<div class="mb-6">
      <div class="flex items-center gap-3 mb-2">
        <span class="bg-discord-accent/20 text-discord-accent px-2 py-1 rounded text-sm font-mono">${penalty.code}</span>
        <span class="text-xs text-discord-muted uppercase">${penalty.category}</span>
      </div>
      <h1 class="text-2xl font-bold text-discord-text">${penalty.name}</h1>
    </div>`,
    
    `<div class="bg-discord-light rounded-lg p-4 mb-6">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-discord-muted text-sm">Süre:</span>
        <span class="text-discord-accent font-semibold">${penalty.duration}</span>
      </div>
      <p class="text-discord-text">${penalty.description}</p>
    </div>`,
  ];

  if (penalty.conditions.length > 0) {
    sections.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-discord-text mb-3">Koşullar</h2>
        <ul class="space-y-2">
          ${penalty.conditions.map(c => `<li class="flex items-start gap-2 text-discord-text"><span class="text-discord-accent">•</span>${c}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  if (penalty.alternatives && penalty.alternatives.length > 0) {
    sections.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-discord-text mb-3">Alternatifler / Esnetilebilir Durumlar</h2>
        <ul class="space-y-2">
          ${penalty.alternatives.map(a => `<li class="flex items-start gap-2 text-discord-muted"><span class="text-discord-yellow">→</span>${a}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  if (penalty.examples.length > 0) {
    sections.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-discord-text mb-3">Örnekler</h2>
        <div class="space-y-3">
          ${penalty.examples.map(e => `<div class="bg-discord-darker rounded-lg p-3 text-discord-muted text-sm">${e}</div>`).join('')}
        </div>
      </div>
    `);
  }

  let html = sections.join('');
  if (highlightTerms) {
    html = highlightSearchTerms(html, highlightTerms);
  }
  return html;
}

// Command içerik render
function renderCommandContent(command: CommandDefinition, highlightTerms?: string[]): string {
  const sections = [
    `<div class="mb-6">
      <h1 class="text-2xl font-bold text-discord-accent font-mono">${command.command}</h1>
      <p class="text-discord-text mt-2">${command.description}</p>
    </div>`,
    
    `<div class="bg-discord-light rounded-lg p-4 mb-6">
      <h2 class="text-sm font-semibold text-discord-muted mb-2">Kullanım</h2>
      <code class="text-discord-accent font-mono">${command.usage}</code>
    </div>`,
  ];

  if (command.permissions.length > 0) {
    sections.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-discord-text mb-3">Gerekli Yetkiler</h2>
        <div class="flex flex-wrap gap-2">
          ${command.permissions.map(p => `<span class="bg-discord-darker px-2 py-1 rounded text-sm text-discord-muted">${p}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (command.examples.length > 0) {
    sections.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-discord-text mb-3">Örnekler</h2>
        <div class="space-y-2">
          ${command.examples.map(e => `<div class="bg-discord-darker rounded-lg p-3 font-mono text-sm text-discord-text">${e}</div>`).join('')}
        </div>
      </div>
    `);
  }

  let html = sections.join('');
  if (highlightTerms) {
    html = highlightSearchTerms(html, highlightTerms);
  }
  return html;
}

// Procedure içerik render
function renderProcedureContent(procedure: ProcedureDefinition, highlightTerms?: string[]): string {
  const stepsHtml = parseMarkdown(procedure.steps);
  
  const sections = [
    `<div class="mb-6">
      <h1 class="text-2xl font-bold text-discord-text">${procedure.title}</h1>
      <p class="text-discord-muted mt-2">${procedure.description}</p>
    </div>`,
  ];

  if (procedure.requiredPermissions.length > 0) {
    sections.push(`
      <div class="bg-discord-light rounded-lg p-4 mb-6">
        <h2 class="text-sm font-semibold text-discord-muted mb-2">Gerekli Yetkiler</h2>
        <div class="flex flex-wrap gap-2">
          ${procedure.requiredPermissions.map(p => `<span class="bg-discord-darker px-2 py-1 rounded text-sm text-discord-accent">${p}</span>`).join('')}
        </div>
      </div>
    `);
  }

  sections.push(`
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-discord-text mb-4">Adımlar</h2>
      <div class="prose-discord">${stepsHtml}</div>
    </div>
  `);

  if (procedure.relatedCommands.length > 0) {
    sections.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-discord-text mb-3">İlgili Komutlar</h2>
        <div class="flex flex-wrap gap-2">
          ${procedure.relatedCommands.map(c => `<span class="bg-discord-accent/20 text-discord-accent px-2 py-1 rounded text-sm font-mono">${c}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (procedure.relatedPenalties.length > 0) {
    sections.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-discord-text mb-3">İlgili Cezalar</h2>
        <div class="flex flex-wrap gap-2">
          ${procedure.relatedPenalties.map(p => `<span class="bg-discord-red/20 text-discord-red px-2 py-1 rounded text-sm">${p}</span>`).join('')}
        </div>
      </div>
    `);
  }

  let html = sections.join('');
  if (highlightTerms) {
    html = highlightSearchTerms(html, highlightTerms);
  }
  return html;
}


// Ana ContentViewer bileşeni
export function ContentViewer({
  type,
  content,
  highlightTerms,
  prevContent,
  nextContent,
  onNavigate,
  userId,
}: ContentViewerProps): React.ReactElement {
  const [copied, setCopied] = React.useState(false);

  // İçeriği render et
  const renderedContent = useMemo(() => {
    switch (type) {
      case 'guide':
        return renderGuideContent(content as GuideContent, highlightTerms);
      case 'penalty':
        return renderPenaltyContent(content as PenaltyDefinition, highlightTerms);
      case 'command':
        return renderCommandContent(content as CommandDefinition, highlightTerms);
      case 'procedure':
        return renderProcedureContent(content as ProcedureDefinition, highlightTerms);
      default:
        return '<p class="text-discord-muted">İçerik bulunamadı.</p>';
    }
  }, [type, content, highlightTerms]);

  // Başlığı al
  const title = useMemo(() => {
    switch (type) {
      case 'guide':
        return (content as GuideContent).title;
      case 'penalty':
        return (content as PenaltyDefinition).name;
      case 'command':
        return (content as CommandDefinition).command;
      case 'procedure':
        return (content as ProcedureDefinition).title;
      default:
        return 'İçerik';
    }
  }, [type, content]);

  // İçerik ID'sini al
  const contentId = useMemo(() => {
    switch (type) {
      case 'guide':
        return (content as GuideContent).slug;
      case 'penalty':
        return (content as PenaltyDefinition).id;
      case 'command':
        return (content as CommandDefinition).id;
      case 'procedure':
        return (content as ProcedureDefinition).id;
      default:
        return 'unknown';
    }
  }, [type, content]);

  // Navigasyon handler
  const handleNavigate = useCallback(
    (href: string) => {
      if (onNavigate) {
        onNavigate(href);
      } else {
        window.location.href = href;
      }
    },
    [onNavigate]
  );

  /**
   * İçerik kopyalama logunu API'ye gönder
   * Requirement 12.3: WHEN a user copies a template or content THEN THE System SHALL log the copy action with content details
   */
  const logContentCopy = useCallback(async () => {
    try {
      await fetch('/api/logs/copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'content',
          contentId: contentId,
          contentTitle: title,
          contentType: type,
          userId: userId,
        }),
      });
    } catch (error) {
      // Loglama hatası sessizce yoksayılır - kullanıcı deneyimini etkilememeli
      console.error('Content copy log error:', error);
    }
  }, [contentId, title, type, userId]);

  // İçeriği kopyala
  const handleCopy = useCallback(async () => {
    try {
      // HTML'den düz metin çıkar
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderedContent;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      
      // Kopyalama işlemini logla (Requirement 12.3)
      await logContentCopy();
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Kopyalama hatası:', err);
    }
  }, [renderedContent, logContentCopy]);

  return (
    <div className="flex flex-col h-full">
      {/* Header - Responsive */}
      <div className="sticky top-0 z-10 bg-discord-darker border-b border-discord-light px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold text-discord-text truncate flex-1 min-w-0">
            {title}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-discord-muted hover:text-discord-text flex-shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 sm:mr-2 text-discord-green" />
                <span className="hidden sm:inline">Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Kopyala</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* İçerik - Responsive padding ve max-width */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
        <article
          className="max-w-full sm:max-w-2xl lg:max-w-3xl mx-auto prose-sm sm:prose"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </div>

      {/* Navigasyon - Responsive */}
      {(prevContent || nextContent) && (
        <div className="sticky bottom-0 bg-discord-darker border-t border-discord-light px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between max-w-full sm:max-w-2xl lg:max-w-3xl mx-auto gap-2">
            {/* Önceki */}
            {prevContent ? (
              <Button
                variant="ghost"
                onClick={() => handleNavigate(prevContent.href)}
                className="flex items-center gap-1 sm:gap-2 text-discord-muted hover:text-discord-text px-2 sm:px-4 max-w-[45%]"
              >
                <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-xs text-discord-muted hidden sm:block">Önceki</span>
                  <span className="text-xs sm:text-sm truncate max-w-full">
                    {prevContent.title}
                  </span>
                </div>
              </Button>
            ) : (
              <div />
            )}

            {/* Sonraki */}
            {nextContent ? (
              <Button
                variant="ghost"
                onClick={() => handleNavigate(nextContent.href)}
                className="flex items-center gap-1 sm:gap-2 text-discord-muted hover:text-discord-text px-2 sm:px-4 max-w-[45%]"
              >
                <div className="flex flex-col items-end min-w-0">
                  <span className="text-xs text-discord-muted hidden sm:block">Sonraki</span>
                  <span className="text-xs sm:text-sm truncate max-w-full">
                    {nextContent.title}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContentViewer;
