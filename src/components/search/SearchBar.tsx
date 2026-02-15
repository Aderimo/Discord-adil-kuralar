'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Book, Gavel, Terminal, FileText, X } from 'lucide-react';
import { searchContent } from '@/lib/content';
import type { SearchResult, SearchResultType } from '@/types/content';

interface SearchResultWithHref extends SearchResult {
  href: string;
}

const categoryConfig: Record<SearchResultType, { label: string; icon: React.ReactNode }> = {
  madde: { label: 'Kılavuz', icon: <Book className="h-4 w-4" /> },
  ceza: { label: 'Cezalar', icon: <Gavel className="h-4 w-4" /> },
  komut: { label: 'Komutlar', icon: <Terminal className="h-4 w-4" /> },
  prosedur: { label: 'Prosedürler', icon: <FileText className="h-4 w-4" /> },
};

function getResultHref(result: SearchResult): string {
  switch (result.type) {
    case 'madde': return `/guide/${result.category}`;
    case 'ceza': return `/penalties/${result.category}`;
    case 'komut': return `/commands`;
    case 'prosedur': return `/procedures/${result.category}`;
    default: return '/';
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

interface SearchBarProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
}

export function SearchBar({ isOpen: controlledIsOpen, onOpenChange, placeholder = 'Ara...' }: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const debouncedQuery = useDebounce(query, 200);

  const results: SearchResultWithHref[] = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchContent(debouncedQuery).map((r) => ({ ...r, href: getResultHref(r) }));
  }, [debouncedQuery]);

  const grouped = useMemo(() => {
    const g: Record<SearchResultType, SearchResultWithHref[]> = { madde: [], ceza: [], komut: [], prosedur: [] };
    results.forEach((r) => { if (g[r.type]) g[r.type].push(r); });
    return g;
  }, [results]);

  const flatResults = useMemo(() => {
    const order: SearchResultType[] = ['madde', 'ceza', 'komut', 'prosedur'];
    return order.flatMap((type) => grouped[type]);
  }, [grouped]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
    else { setQuery(''); setSelectedIndex(-1); }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsOpen(true); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  const navigateToResult = useCallback((result: SearchResultWithHref) => {
    setIsOpen(false);
    router.push(result.href);
  }, [router, setIsOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (flatResults.length === 0) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setSelectedIndex((p) => p < flatResults.length - 1 ? p + 1 : 0); break;
      case 'ArrowUp': e.preventDefault(); setSelectedIndex((p) => p > 0 ? p - 1 : flatResults.length - 1); break;
      case 'Enter': {
        e.preventDefault();
        const sel = flatResults[selectedIndex];
        if (sel) navigateToResult(sel);
        break;
      }
      case 'Escape': e.preventDefault(); setIsOpen(false); break;
    }
  }, [flatResults, selectedIndex, navigateToResult, setIsOpen]);

  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="sr-only"><DialogTitle>İçerik Ara</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-discord-light">
          <Search className="h-5 w-5 text-discord-muted shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Arama"
          />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="text-discord-muted hover:text-discord-text transition-colors" aria-label="Temizle">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
          {!hasQuery && (
            <div className="flex flex-col items-center justify-center py-8 text-discord-muted">
              <Search className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Aramak için yazmaya başlayın</p>
            </div>
          )}
          {hasQuery && !hasResults && (
            <div className="flex flex-col items-center justify-center py-8 text-discord-muted">
              <Search className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">Sonuç bulunamadı</p>
            </div>
          )}
          {hasResults && (['madde', 'ceza', 'komut', 'prosedur'] as SearchResultType[]).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const config = categoryConfig[type];
            const startIdx = flatResults.findIndex((r) => r.id === items[0]?.id);
            return (
              <div key={type} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-discord-muted uppercase tracking-wider">
                  {config.icon}<span>{config.label}</span>
                  <span className="ml-auto text-discord-muted/60">{items.length}</span>
                </div>
                {items.map((result, idx) => {
                  const index = startIdx + idx;
                  return (
                    <button key={result.id} onClick={() => navigateToResult(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-start gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                        index === selectedIndex ? 'bg-discord-accent/20 text-discord-text' : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
                      }`} role="option" aria-selected={index === selectedIndex}>
                      <span className="mt-0.5 text-discord-muted">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        <p className="text-sm text-discord-muted truncate">{result.excerpt}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SearchBar;
