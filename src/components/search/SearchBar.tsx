'use client';

/**
 * SearchBar Bileşeni
 * 
 * Anlık arama (debounced) ile içerik arama
 * - Sonuç kategorileri gösterimi
 * - Sonuç tıklama ile navigasyon
 * - "Sonuç bulunamadı" durumu
 * - Klavye navigasyonu (ok tuşları, enter)
 * 
 * Requirements: 5.1, 5.2, 5.4
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Search,
  Book,
  Gavel,
  Terminal,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import type { SearchResultType } from '@/types/content';

/**
 * Arama sonucu tipi (API'den gelen)
 */
interface SearchResultWithHref {
  id: string;
  type: SearchResultType;
  title: string;
  excerpt: string;
  category: string;
  relevanceScore: number;
  href: string;
}

/**
 * Kategoriye göre gruplandırılmış sonuçlar
 */
interface GroupedResults {
  madde: SearchResultWithHref[];
  ceza: SearchResultWithHref[];
  komut: SearchResultWithHref[];
  prosedur: SearchResultWithHref[];
}

/**
 * Kategori konfigürasyonu
 */
const categoryConfig: Record<SearchResultType, { label: string; icon: React.ReactNode }> = {
  madde: { label: 'Kılavuz', icon: <Book className="h-4 w-4" /> },
  ceza: { label: 'Cezalar', icon: <Gavel className="h-4 w-4" /> },
  komut: { label: 'Komutlar', icon: <Terminal className="h-4 w-4" /> },
  prosedur: { label: 'Prosedürler', icon: <FileText className="h-4 w-4" /> },
};

/**
 * Debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout((): void => {
      setDebouncedValue(value);
    }, delay);

    return (): void => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface SearchBarProps {
  /** Dialog açık mı? */
  isOpen?: boolean;
  /** Dialog açma/kapama callback */
  onOpenChange?: (open: boolean) => void;
  /** Placeholder metni */
  placeholder?: string;
}

export function SearchBar({
  isOpen: controlledIsOpen,
  onOpenChange,
  placeholder = 'Ara...',
}: SearchBarProps): React.ReactElement {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultWithHref[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  // Controlled vs uncontrolled
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  // Debounced query (300ms)
  const debouncedQuery = useDebounce(query, 300);

  // Sonuçları kategorilere göre grupla
  const groupedResults = useMemo((): GroupedResults => {
    const grouped: GroupedResults = {
      madde: [],
      ceza: [],
      komut: [],
      prosedur: [],
    };

    results.forEach((result) => {
      if (grouped[result.type]) {
        grouped[result.type].push(result);
      }
    });

    return grouped;
  }, [results]);

  // Düz liste (klavye navigasyonu için)
  const flatResults = useMemo((): SearchResultWithHref[] => {
    const flat: SearchResultWithHref[] = [];
    const order: SearchResultType[] = ['madde', 'ceza', 'komut', 'prosedur'];
    
    order.forEach((type) => {
      flat.push(...groupedResults[type]);
    });
    
    return flat;
  }, [groupedResults]);

  // Arama API çağrısı
  const performSearch = useCallback(async (searchQuery: string): Promise<void> => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
      } else {
        setError(data.error || 'Arama sırasında bir hata oluştu');
        setResults([]);
      }
    } catch {
      setError('Arama sırasında bir hata oluştu');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced query değiştiğinde ara
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Dialog açıldığında input'a focus
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Dialog kapandığında state'i sıfırla
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      setError(null);
    }
  }, [isOpen]);

  // Klavye kısayolu (⌘K veya Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsOpen]);

  // Sonuca git
  const navigateToResult = useCallback((result: SearchResultWithHref) => {
    setIsOpen(false);
    router.push(result.href as never);
  }, [router, setIsOpen]);

  // Klavye navigasyonu
  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (flatResults.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < flatResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : flatResults.length - 1
        );
        break;
      case 'Enter': {
        e.preventDefault();
        const selectedResult = flatResults[selectedIndex];
        if (selectedIndex >= 0 && selectedIndex < flatResults.length && selectedResult) {
          navigateToResult(selectedResult);
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [flatResults, selectedIndex, navigateToResult, setIsOpen]);

  // Sonuç öğesi render
  const renderResultItem = (result: SearchResultWithHref, index: number): React.ReactElement => {
    const isSelected = index === selectedIndex;
    const config = categoryConfig[result.type];

    return (
      <button
        key={result.id}
        onClick={() => navigateToResult(result)}
        onMouseEnter={() => setSelectedIndex(index)}
        className={`
          w-full flex items-start gap-3 px-3 py-2 text-left rounded-md transition-colors
          ${isSelected 
            ? 'bg-discord-accent/20 text-discord-text' 
            : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
          }
        `}
        role="option"
        aria-selected={isSelected}
      >
        <span className="mt-0.5 text-discord-muted">
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{result.title}</p>
          <p className="text-sm text-discord-muted truncate">{result.excerpt}</p>
        </div>
        <span className="text-xs text-discord-muted bg-discord-darker px-2 py-0.5 rounded">
          {config.label}
        </span>
      </button>
    );
  };

  // Kategori grubu render
  const renderCategoryGroup = (type: SearchResultType, items: SearchResultWithHref[]): React.ReactElement | null => {
    if (items.length === 0) {
      return null;
    }

    const config = categoryConfig[type];
    const firstItem = items[0];
    const startIndex = firstItem ? flatResults.findIndex((r) => r.id === firstItem.id) : 0;

    return (
      <div key={type} className="mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-discord-muted uppercase tracking-wider">
          {config.icon}
          <span>{config.label}</span>
          <span className="ml-auto text-discord-muted/60">{items.length}</span>
        </div>
        <div className="space-y-0.5" role="listbox">
          {items.map((result, idx) => renderResultItem(result, startIndex + idx))}
        </div>
      </div>
    );
  };

  // Sonuç var mı?
  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-xl p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>İçerik Ara</DialogTitle>
        </DialogHeader>
        
        {/* Arama input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-discord-light">
          <Search className="h-5 w-5 text-discord-muted shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Arama"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={hasResults}
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 text-discord-muted animate-spin" />
          )}
          {query && !isLoading && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                inputRef.current?.focus();
              }}
              className="text-discord-muted hover:text-discord-text transition-colors"
              aria-label="Aramayı temizle"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sonuçlar */}
        <div 
          id="search-results"
          className="max-h-[60vh] overflow-y-auto p-2"
          role="listbox"
          aria-label="Arama sonuçları"
        >
          {/* Yükleniyor */}
          {isLoading && hasQuery && (
            <div className="flex items-center justify-center py-8 text-discord-muted">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Aranıyor...</span>
            </div>
          )}

          {/* Hata */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-discord-muted">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Sonuç bulunamadı */}
          {!isLoading && !error && hasQuery && !hasResults && (
            <div className="flex flex-col items-center justify-center py-8 text-discord-muted">
              <Search className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">Sonuç bulunamadı</p>
              <p className="text-sm mt-1">
                &quot;{query}&quot; için sonuç bulunamadı
              </p>
            </div>
          )}

          {/* Sonuçlar */}
          {!isLoading && !error && hasResults && (
            <>
              {renderCategoryGroup('madde', groupedResults.madde)}
              {renderCategoryGroup('ceza', groupedResults.ceza)}
              {renderCategoryGroup('komut', groupedResults.komut)}
              {renderCategoryGroup('prosedur', groupedResults.prosedur)}
            </>
          )}

          {/* Boş durum - arama yapılmadı */}
          {!isLoading && !error && !hasQuery && (
            <div className="flex flex-col items-center justify-center py-8 text-discord-muted">
              <Search className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Aramak için yazmaya başlayın</p>
              <div className="flex items-center gap-2 mt-4 text-xs">
                <kbd className="px-2 py-1 bg-discord-darker rounded border border-discord-light">↑↓</kbd>
                <span>Gezin</span>
                <kbd className="px-2 py-1 bg-discord-darker rounded border border-discord-light ml-2">Enter</kbd>
                <span>Seç</span>
                <kbd className="px-2 py-1 bg-discord-darker rounded border border-discord-light ml-2">Esc</kbd>
                <span>Kapat</span>
              </div>
            </div>
          )}
        </div>

        {/* Alt bilgi */}
        {hasResults && (
          <div className="px-4 py-2 border-t border-discord-light text-xs text-discord-muted flex items-center justify-between">
            <span>{results.length} sonuç bulundu</span>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-discord-darker rounded text-[10px]">↑↓</kbd>
              <span>Gezin</span>
              <kbd className="px-1.5 py-0.5 bg-discord-darker rounded text-[10px] ml-2">Enter</kbd>
              <span>Seç</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SearchBar;
