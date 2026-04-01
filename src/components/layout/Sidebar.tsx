'use client';

/**
 * Sidebar Bileşeni
 *
 * - Bölüm başlığına tıklanınca ilgili ana sayfaya yönlendirir
 * - Chevron ikonu bölümü açıp kapatır
 * - Doğru CSS değişkeniyle animasyon
 */

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { hasRole } from '@/lib/rbac';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SearchBar } from '@/components/search';
import {
  Book,
  Gavel,
  Terminal,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Mic,
  Plus,
  Flag,
  Skull,
  Search,
  LayoutTemplate,
} from 'lucide-react';
import {
  loadGuideContent,
  loadPenalties,
  loadCommands,
  loadProcedures,
} from '@/lib/content';
import type { PenaltyCategory } from '@/types/content';

const penaltyCategoryConfig: Record<
  PenaltyCategory,
  { label: string; icon: React.ReactNode }
> = {
  yazili: { label: 'Yazılı Cezalar', icon: <AlertTriangle className="h-4 w-4" /> },
  sesli: { label: 'Sesli Cezalar', icon: <Mic className="h-4 w-4" /> },
  ekstra: { label: 'Ekstra Cezalar', icon: <Plus className="h-4 w-4" /> },
  marked: { label: 'Marked', icon: <Flag className="h-4 w-4" /> },
  blacklist: { label: 'Blacklist', icon: <Skull className="h-4 w-4" /> },
};

interface MenuSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: MenuItem[];
  defaultOpen?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const guideContent = useMemo(() => loadGuideContent(), []);
  const penalties = useMemo(() => loadPenalties(), []);
  const commands = useMemo(() => loadCommands(), []);
  const procedures = useMemo(() => loadProcedures(), []);

  const penaltiesByCategory = useMemo(() => {
    const grouped: Record<PenaltyCategory, typeof penalties> = {
      yazili: [],
      sesli: [],
      ekstra: [],
      marked: [],
      blacklist: [],
    };
    penalties.forEach((penalty) => {
      if (grouped[penalty.category]) {
        grouped[penalty.category].push(penalty);
      }
    });
    return grouped;
  }, [penalties]);

  void penaltiesByCategory;

  const menuSections: MenuSection[] = useMemo(() => {
    const sections: MenuSection[] = [
      {
        id: 'guide',
        label: 'Yetkili Kılavuzu',
        icon: <Book className="h-4 w-4" />,
        href: '/guide',
        defaultOpen: true,
        children: guideContent.map((guide) => ({
          id: guide.id,
          label: guide.title,
          href: `/guide/${guide.slug}`,
        })),
      },
      {
        id: 'penalties',
        label: 'Cezalar',
        icon: <Gavel className="h-4 w-4" />,
        href: '/penalties',
        children: Object.entries(penaltyCategoryConfig).map(([category, config]) => ({
          id: `penalty-cat-${category}`,
          label: config.label,
          href: `/penalties/${category}`,
          icon: config.icon,
        })),
      },
      {
        id: 'commands',
        label: 'Komutlar',
        icon: <Terminal className="h-4 w-4" />,
        href: '/commands',
        children: [
          { id: 'cmd-ceza', label: `Ceza Komutları (${commands.filter(c => (c.category || 'bilgi') === 'ceza').length})`, href: '/commands/ceza' },
          { id: 'cmd-bilgi', label: `Bilgi Komutları (${commands.filter(c => (c.category || 'bilgi') === 'bilgi').length})`, href: '/commands/bilgi' },
          { id: 'cmd-sesli', label: `Sesli Kanal (${commands.filter(c => (c.category || 'bilgi') === 'sesli').length})`, href: '/commands/sesli' },
          { id: 'cmd-gkplus', label: `GK+ Komutları (${commands.filter(c => (c.category || 'bilgi') === 'gk-plus').length})`, href: '/commands/gk-plus' },
        ],
      },
      {
        id: 'procedures',
        label: 'Prosedürler',
        icon: <FileText className="h-4 w-4" />,
        href: '/procedures',
        children: procedures.map((proc) => ({
          id: proc.id,
          label: proc.title,
          href: `/procedures/${proc.slug}`,
        })),
      },
      {
        id: 'templates',
        label: 'Şablonlar',
        icon: <LayoutTemplate className="h-4 w-4" />,
        href: '/templates',
      },
    ];

    // Admin Paneli - ust_yetkili ve üstü için
    if (user && hasRole(user.role, 'ust_yetkili')) {
      sections.push({
        id: 'admin',
        label: 'Admin Paneli',
        icon: <Settings className="h-4 w-4" />,
        href: '/admin',
        children: [
          { id: 'admin-users', label: 'Kullanıcı Yönetimi', href: '/admin' },
          { id: 'admin-logs', label: 'Aktivite Logları', href: '/admin/logs' },
        ],
      });
    }

    return sections;
  }, [guideContent, commands, procedures, user]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuSections.forEach((section) => {
      initial[section.id] = section.defaultOpen || false;
    });

    // sessionStorage'dan kayıtlı durumu geri yükle
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('sidebar_open_sections');
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, boolean>;
          menuSections.forEach((section) => {
            if (section.id in parsed) {
              initial[section.id] = parsed[section.id] as boolean;
            }
          });
        }
      } catch {
        // sessionStorage erişilemiyorsa varsayılan değerleri kullan
      }
    }

    return initial;
  });

  // openSections değiştiğinde sessionStorage'a kaydet
  useEffect(() => {
    try {
      sessionStorage.setItem('sidebar_open_sections', JSON.stringify(openSections));
    } catch {
      // ignore
    }
  }, [openSections]);

  const toggleSection = (sectionId: string): void => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const openSection = (sectionId: string): void => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: true,
    }));
  };

  const isActive = (href: string): boolean => {
    if (href === pathname) {
      return true;
    }
    if (href !== '/' && pathname.startsWith(href.split('#')[0] ?? href)) {
      return true;
    }
    return false;
  };

  return (
    <nav className="flex flex-col h-full py-3 sm:py-4" aria-label="Ana navigasyon">
      <div className="px-2 sm:px-3 mb-3 sm:mb-4">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-md bg-discord-darker px-3 py-2.5 sm:py-2 text-sm text-discord-muted hover:bg-discord-light hover:text-discord-text transition-colors"
          aria-label="Ara"
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Ara...</span>
          <kbd className="ml-auto hidden rounded bg-discord-light px-1.5 py-0.5 text-xs font-medium text-discord-muted md:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      <SearchBar
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        placeholder="Madde, ceza, komut ara..."
      />

      <div className="flex-1 overflow-y-auto px-1.5 sm:px-2 space-y-0.5 sm:space-y-1 scrollbar-thin scrollbar-thumb-discord-light scrollbar-track-transparent">
        {menuSections.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            isOpen={openSections[section.id] ?? false}
            onToggle={() => toggleSection(section.id)}
            onOpen={() => openSection(section.id)}
            isActive={isActive}
          />
        ))}
      </div>

      <div className="mt-auto px-3 sm:px-4 py-2 sm:py-3 border-t border-discord-light">
        <p className="text-xs text-discord-muted text-center">
          Yetkili Kılavuzu v2.0
        </p>
      </div>
    </nav>
  );
}

interface SidebarSectionProps {
  section: MenuSection;
  isOpen: boolean;
  onToggle: () => void;
  onOpen: () => void;
  isActive: (href: string) => boolean;
}

function SidebarSection({
  section,
  isOpen,
  onToggle,
  onOpen,
  isActive,
}: SidebarSectionProps): React.ReactElement {
  const hasChildren = section.children && section.children.length > 0;
  const router = useRouter();

  // Eğer children yoksa direkt link
  if (!hasChildren && section.href) {
    return (
      <Link
        href={section.href as never}
        className={`
          flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
          ${
            isActive(section.href)
              ? 'bg-discord-accent/20 text-discord-accent'
              : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
          }
        `}
      >
        {section.icon}
        <span>{section.label}</span>
      </Link>
    );
  }

  const isChildActive = section.children?.some((child) => isActive(child.href)) ?? false;

  const labelClass = `
    flex flex-1 items-center gap-2 rounded-l-md px-3 py-2 text-sm font-medium transition-colors
    ${
      isChildActive
        ? 'text-discord-accent'
        : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
    }
  `;

  const chevronClass = `
    flex items-center justify-center px-2 py-2 rounded-r-md text-discord-muted
    hover:bg-discord-light hover:text-discord-text transition-colors
  `;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="flex w-full items-center">
        {/* Bölüm başlığı - tıklanınca ana sayfaya yönlendirir ve açar */}
        {section.href ? (
          <button
            onClick={() => {
              router.push(section.href as never);
              onOpen();
            }}
            className={labelClass}
          >
            {section.icon}
            <span className="flex-1 text-left">{section.label}</span>
          </button>
        ) : (
          <CollapsibleTrigger className={labelClass}>
            {section.icon}
            <span className="flex-1 text-left">{section.label}</span>
          </CollapsibleTrigger>
        )}

        {/* Chevron - sadece aç/kapat */}
        <CollapsibleTrigger className={chevronClass} aria-label="Aç/kapat">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 transition-transform" />
          )}
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="ml-4 mt-1 space-y-1 border-l border-discord-light pl-2">
          {section.children?.map((item) => (
            <Link
              key={item.id}
              href={item.href as never}
              className={`
                flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors
                ${
                  isActive(item.href)
                    ? 'bg-discord-accent/20 text-discord-accent'
                    : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
                }
              `}
            >
              {item.icon && item.icon}
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default Sidebar;
