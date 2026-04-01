'use client';

/**
 * ContentViewer Bileşeni
 * 
 * Markdown içerik render, arama terimlerini vurgulama ve bölümler arası navigasyon
 * 
 * Requirements: 4.2
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy, Check, List } from 'lucide-react';
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
  highlightTerms?: string[];
  /** Önceki içerik (navigasyon için) */
  prevContent?: { title: string; href: string } | null;
  /** Sonraki içerik (navigasyon için) */
  nextContent?: { title: string; href: string } | null;
  /** Navigasyon callback */
  onNavigate?: (href: string) => void;
}

// Heading metninden URL-friendly ID üret
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

interface TocItem {
  level: 1 | 2 | 3;
  text: string;
  id: string;
}

// Markdown'dan başlıkları çıkar
function extractTOC(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const m3 = line.match(/^### (.+)$/);
    if (m3) { items.push({ level: 3, text: m3[1], id: slugify(m3[1]) }); continue; }
    const m2 = line.match(/^## (.+)$/);
    if (m2) { items.push({ level: 2, text: m2[1], id: slugify(m2[1]) }); continue; }
    const m1 = line.match(/^# (.+)$/);
    if (m1) { items.push({ level: 1, text: m1[1], id: slugify(m1[1]) }); }
  }
  return items;
}

// Basit markdown parser
function parseMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (önce işle, içerikleri bozulmasın)
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="bg-discord-darker rounded-lg p-4 my-5 overflow-x-auto border border-discord-lighter"><code class="text-sm font-mono text-discord-text">${code.trim()}</code></pre>`);
    return `__CODEBLOCK_${idx}__`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-discord-darker px-1.5 py-0.5 rounded text-sm font-mono text-discord-accent">$1</code>');

  // Headers (with IDs for TOC anchoring)
  html = html.replace(/^### (.+)$/gm, (_, t) => `<h3 id="${slugify(t)}" class="text-base font-semibold text-discord-text mt-6 mb-2">${t}</h3>`);
  html = html.replace(/^## (.+)$/gm, (_, t) => `<h2 id="${slugify(t)}" class="text-lg font-bold text-discord-text mt-8 mb-3 pb-1 border-b border-discord-lighter">${t}</h2>`);
  html = html.replace(/^# (.+)$/gm, (_, t) => `<h1 id="${slugify(t)}" class="text-2xl font-bold text-discord-text mt-6 mb-5">${t}</h1>`);

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-discord-text font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong class="text-discord-text font-semibold">$1</strong>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-discord-accent pl-4 my-4 text-discord-muted italic bg-discord-darker/30 py-2 rounded-r">$1</blockquote>');

  // Ordered lists (önce işle)
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal text-discord-text leading-relaxed">$1</li>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-discord-text leading-relaxed">$1</li>');
  html = html.replace(/^\* (.+)$/gm, '<li class="ml-5 list-disc text-discord-text leading-relaxed">$1</li>');

  // Wrap consecutive list items in <ul> or <ol>
  html = html.replace(/(<li[^>]*>[\s\S]*?<\/li>(\n|$))+/g, (match) => {
    return `<ul class="my-4 space-y-1.5 pl-1">${match}</ul>`;
  });

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="my-6 border-discord-lighter" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-discord-accent hover:underline">$1</a>');

  // Paragraphs - çift satır boşluğu ile ayrılmış bloklar
  html = html.split(/\n{2,}/).map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return trimmed;
    if (trimmed.startsWith('__CODEBLOCK_')) return trimmed;
    return `<p class="text-discord-text leading-7 mb-4">${trimmed.replace(/\n/g, ' ')}</p>`;
  }).filter(Boolean).join('\n');

  // Tek satır sonlarını koru (liste aralarında değilse boşluk bırak)
  html = html.replace(/\n(?!<)/g, '\n');

  // Code block'ları geri koy
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODEBLOCK_${idx}__`, block);
  });

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
    `<div class="mb-8">
      <h1 class="text-2xl font-bold text-discord-text mb-3">${procedure.title}</h1>
      <p class="text-discord-muted text-base leading-relaxed">${procedure.description}</p>
    </div>`,
  ];

  if (procedure.requiredPermissions.length > 0) {
    sections.push(`
      <div class="bg-discord-light rounded-lg p-4 mb-7 border border-discord-lighter">
        <h2 class="text-xs font-semibold text-discord-muted uppercase tracking-wider mb-3">Gerekli Yetkiler</h2>
        <div class="flex flex-wrap gap-2">
          ${procedure.requiredPermissions.map(p => `<span class="bg-discord-accent/10 border border-discord-accent/30 text-discord-accent px-3 py-1 rounded-full text-sm font-medium">${p}</span>`).join('')}
        </div>
      </div>
    `);
  }

  sections.push(`
    <div class="mb-7">
      <div class="space-y-1">${stepsHtml}</div>
    </div>
  `);

  if (procedure.relatedCommands.length > 0) {
    sections.push(`
      <div class="mb-7 bg-discord-darker rounded-lg p-5 border border-discord-lighter">
        <h2 class="text-sm font-semibold text-discord-muted uppercase tracking-wider mb-3">İlgili Komutlar</h2>
        <div class="flex flex-wrap gap-2">
          ${procedure.relatedCommands.map(c => `<span class="bg-discord-accent/20 text-discord-accent px-3 py-1.5 rounded text-sm font-mono border border-discord-accent/20">${c}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (procedure.relatedPenalties.length > 0) {
    sections.push(`
      <div class="mb-7 bg-discord-darker rounded-lg p-5 border border-discord-lighter">
        <h2 class="text-sm font-semibold text-discord-muted uppercase tracking-wider mb-3">İlgili Cezalar</h2>
        <div class="flex flex-wrap gap-2">
          ${procedure.relatedPenalties.map(p => `<span class="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded text-sm">${p}</span>`).join('')}
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
}: ContentViewerProps): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

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

  // TOC - sadece guide ve procedure için
  const tocItems = useMemo((): TocItem[] => {
    if (type === 'guide') {
      return extractTOC((content as GuideContent).content);
    }
    if (type === 'procedure') {
      return extractTOC((content as ProcedureDefinition).steps);
    }
    return [];
  }, [type, content]);

  const hasToc = tocItems.length > 0;

  // Scroll'da aktif başlığı izle
  useEffect(() => {
    if (!hasToc || !contentRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    );
    const headings = contentRef.current.querySelectorAll('h1[id], h2[id], h3[id]');
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [hasToc, renderedContent]);

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

  // İçeriği kopyala
  const handleCopy = useCallback(async () => {
    try {
      // HTML'den düz metin çıkar
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderedContent;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Kopyalama hatası:', err);
    }
  }, [renderedContent]);

  return (
    <div className="flex flex-col h-full">
      {/* Header - Responsive */}
      <div className="sticky top-0 z-10 bg-discord-darker border-b border-discord-light px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold text-discord-text truncate flex-1 min-w-0">
            {title}
          </h1>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasToc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTocOpen(v => !v)}
                className={`text-discord-muted hover:text-discord-text ${tocOpen ? 'bg-discord-light text-discord-text' : ''}`}
                title="İçindekiler"
              >
                <List className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">İçindekiler</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-discord-muted hover:text-discord-text"
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
      </div>

      {/* İçerik + TOC yan panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Ana içerik */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8" ref={contentRef}>
          <article
            className="max-w-full sm:max-w-2xl lg:max-w-3xl mx-auto"
            style={{ lineHeight: '1.75' }}
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        </div>

        {/* TOC Panel */}
        {hasToc && tocOpen && (
          <aside className="hidden lg:flex flex-col w-56 xl:w-64 flex-shrink-0 border-l border-discord-lighter bg-discord-darker overflow-y-auto py-6 px-4">
            <p className="text-xs font-semibold text-discord-muted uppercase tracking-wider mb-3">İçindekiler</p>
            <nav className="space-y-0.5">
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = contentRef.current?.querySelector(`#${item.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`block text-xs py-1 rounded transition-colors truncate ${
                    item.level === 1 ? 'font-semibold' : item.level === 2 ? 'pl-3' : 'pl-6'
                  } ${
                    activeId === item.id
                      ? 'text-discord-accent'
                      : 'text-discord-muted hover:text-discord-text'
                  }`}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>

      {/* Navigasyon - Responsive */}
      {(prevContent || nextContent) && (
        <div className="bg-discord-darker border-t border-discord-light px-4 sm:px-6 py-3 sm:py-4">
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
