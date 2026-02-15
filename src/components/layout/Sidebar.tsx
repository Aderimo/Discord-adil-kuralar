'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Mic,
  Plus,
  Flag,
  Skull,
  Search,
} from 'lucide-react';
import {
  loadGuideContent,
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

export function Sidebar() {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const guideContent = useMemo(() => loadGuideContent(), []);
  const commands = useMemo(() => loadCommands(), []);
  const procedures = useMemo(() => loadProcedures(), []);

  const menuSections: MenuSection[] = useMemo(() => {
    return [
      {
        id: 'guide',
        label: 'Saniye Yetkili Kılavuzu',
        icon: <Book className="h-4 w-4" />,
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
        children: commands.slice(0, 10).map((cmd) => ({
          id: cmd.id,
          label: cmd.command,
          href: `/commands#${cmd.id}`,
        })),
      },
      {
        id: 'procedures',
        label: 'Prosedürler',
        icon: <FileText className="h-4 w-4" />,
        children: procedures.map((proc) => ({
          id: proc.id,
          label: proc.title,
          href: `/procedures/${proc.slug}`,
        })),
      },
      {
        id: 'templates',
        label: 'Şablonlar',
        icon: <FileText className="h-4 w-4" />,
        href: '/templates',
      },
    ];
  }, [guideContent, commands, procedures]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuSections.forEach((section) => {
      initial[section.id] = section.defaultOpen || false;
    });
    return initial;
  });

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const isActive = (href: string) => {
    if (href === pathname) return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
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

      <div className="flex-1 overflow-y-auto px-1.5 sm:px-2 space-y-0.5 sm:space-y-1">
        {menuSections.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            isOpen={openSections[section.id] ?? false}
            onToggle={() => toggleSection(section.id)}
            isActive={isActive}
          />
        ))}
      </div>

      <div className="mt-auto px-3 sm:px-4 py-2 sm:py-3 border-t border-discord-light space-y-2">
        <p className="text-xs text-discord-muted text-center">Saniye Yetkili Kılavuzu</p>
        <p className="text-xs text-discord-muted/70 text-center">
          Bu siteyi yapan kişi{' '}
          <a href="https://discord.gg/wMmtaG7UCx" target="_blank" rel="noopener noreferrer"
            className="text-discord-accent hover:underline font-medium">Aderimo</a>
          &apos;dur
        </p>
      </div>
    </nav>
  );
}

interface SidebarSectionProps {
  section: MenuSection;
  isOpen: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
}

function SidebarSection({ section, isOpen, onToggle, isActive }: SidebarSectionProps) {
  const hasChildren = section.children && section.children.length > 0;

  if (!hasChildren && section.href) {
    return (
      <Link
        href={section.href}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive(section.href)
            ? 'bg-discord-accent/20 text-discord-accent'
            : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
        }`}
      >
        {section.icon}
        <span>{section.label}</span>
      </Link>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          section.children?.some((child) => isActive(child.href))
            ? 'text-discord-accent'
            : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
        }`}
      >
        {section.icon}
        <span className="flex-1 text-left">{section.label}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 space-y-1 border-l border-discord-light pl-2">
          {section.children?.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-discord-accent/20 text-discord-accent'
                  : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
              }`}
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
