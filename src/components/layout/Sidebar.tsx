'use client';

/**
 * Sidebar Bileşeni
 * 
 * Yetkili Kılavuzu navigasyon menüsü
 * - Yetkili Kılavuzu menüsü (alt bölümlerle)
 * - Cezalar menüsü (kategorilere ayrılmış)
 * - Komutlar menüsü
 * - Prosedürler menüsü
 * - Admin Paneli linki (sadece yetkililere)
 * 
 * Requirements: 4.1, 4.3, 4.4
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
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
} from 'lucide-react';
import {
  loadGuideContent,
  loadPenalties,
  loadCommands,
  loadProcedures,
} from '@/lib/content';
import type { PenaltyCategory } from '@/types/content';

// Ceza kategorisi etiketleri ve ikonları
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

// Menü bölümü tipi
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

  // İçerikleri yükle
  const guideContent = useMemo(() => loadGuideContent(), []);
  const penalties = useMemo(() => loadPenalties(), []);
  const commands = useMemo(() => loadCommands(), []);
  const procedures = useMemo(() => loadProcedures(), []);

  // Cezaları kategorilere göre grupla (gelecekte detaylı menü için kullanılabilir)
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

  // penaltiesByCategory gelecekte detaylı menü için kullanılabilir
  void penaltiesByCategory;

  // Menü yapısını oluştur
  const menuSections: MenuSection[] = useMemo(() => {
    const sections: MenuSection[] = [
      // Saniye Yetkili Kılavuzu
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
      // Cezalar
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
      // Komutlar
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
      // Prosedürler
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
      // Şablonlar
      {
        id: 'templates',
        label: 'Şablonlar',
        icon: <FileText className="h-4 w-4" />,
        href: '/templates',
      },
    ];

    // Admin yetkisi olan roller
    const adminRoles = ['gk', 'council', 'gm', 'gm_plus', 'owner', 'admin', 'ust_yetkili'];
    const ownerRoles = ['owner', 'ust_yetkili'];

    // Admin Paneli - gk ve üstü roller için
    if (user && adminRoles.includes(user.role || '')) {
      const adminChildren = [
        { id: 'admin-users', label: 'Kullanıcı Yönetimi', href: '/admin' },
      ];

      // Log görüntüleme - gm ve üstü
      const logRoles = ['gm', 'gm_plus', 'owner', 'ust_yetkili'];
      if (logRoles.includes(user.role || '')) {
        adminChildren.push({ id: 'admin-logs', label: 'Aktivite Logları', href: '/admin/logs' });
      }

      // Rol yönetimi - sadece owner
      if (ownerRoles.includes(user.role || '')) {
        adminChildren.push({ id: 'admin-settings', label: 'Rol Yönetimi', href: '/admin/settings' });
      }

      sections.push({
        id: 'admin',
        label: 'Admin Paneli',
        icon: <Settings className="h-4 w-4" />,
        href: '/admin',
        children: adminChildren,
      });
    }

    return sections;
  }, [guideContent, commands, procedures, user]);

  // Açık menüleri takip et
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuSections.forEach((section) => {
      initial[section.id] = section.defaultOpen || false;
    });
    return initial;
  });

  // Menü bölümünü aç/kapat
  const toggleSection = (sectionId: string): void => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Aktif menü öğesini kontrol et
  const isActive = (href: string): boolean => {
    if (href === pathname) {
      return true;
    }
    if (href !== '/' && pathname.startsWith(href)) {
      return true;
    }
    return false;
  };

  return (
    <nav className="flex flex-col h-full py-3 sm:py-4" aria-label="Ana navigasyon">
      {/* Arama butonu */}
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

      {/* SearchBar Dialog */}
      <SearchBar
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        placeholder="Madde, ceza, komut ara..."
      />

      {/* Menü bölümleri */}
      <div className="flex-1 overflow-y-auto px-1.5 sm:px-2 space-y-0.5 sm:space-y-1 scrollbar-thin scrollbar-thumb-discord-light scrollbar-track-transparent">
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

      {/* Alt bilgi */}
      <div className="mt-auto px-3 sm:px-4 py-2 sm:py-3 border-t border-discord-light space-y-2">
        <p className="text-xs text-discord-muted text-center">
          Saniye Yetkili Kılavuzu
        </p>
        <p className="text-xs text-discord-muted/70 text-center">
          Bu siteyi yapan kişi{' '}
          <a 
            href="https://discord.gg/wMmtaG7UCx" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-discord-accent hover:underline font-medium"
          >
            Aderimo
          </a>
          &apos;dur
        </p>
      </div>
    </nav>
  );
}

// Sidebar bölüm bileşeni
interface SidebarSectionProps {
  section: MenuSection;
  isOpen: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
}

function SidebarSection({
  section,
  isOpen,
  onToggle,
  isActive,
}: SidebarSectionProps): React.ReactElement {
  const hasChildren = section.children && section.children.length > 0;

  // Eğer children yoksa direkt link
  if (!hasChildren && section.href) {
    return (
      <Link
        href={section.href as never}
        className={`
          flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
          ${isActive(section.href)
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

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className={`
          flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
          ${section.children?.some((child) => isActive(child.href))
            ? 'text-discord-accent'
            : 'text-discord-muted hover:bg-discord-light hover:text-discord-text'
          }
        `}
      >
        {section.icon}
        <span className="flex-1 text-left">{section.label}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 transition-transform" />
        ) : (
          <ChevronRight className="h-4 w-4 transition-transform" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="ml-4 mt-1 space-y-1 border-l border-discord-light pl-2">
          {section.children?.map((item) => (
            <Link
              key={item.id}
              href={item.href as never}
              className={`
                flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors
                ${isActive(item.href)
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
