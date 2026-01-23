'use client';

/**
 * Ana Sayfa (Dashboard)
 * 
 * Tüm bileşenleri birleştiren ana sayfa:
 * - MainLayout with Sidebar
 * - ContentViewer for guide content
 * - SearchBar integration
 * 
 * Requirements: Tüm gereksinimler
 */

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { ContentViewer } from '@/components/content/ContentViewer';
import { loadGuideContent } from '@/lib/content';
import { hasRole } from '@/lib/rbac';
import type { GuideContent } from '@/types/content';
import { Book, Shield, Gavel, Terminal, FileText, Plus } from 'lucide-react';

// Hoşgeldin kartı bileşeni
function WelcomeCard(): React.ReactElement {
  const { user } = useAuth();
  const router = useRouter();
  const canEdit = user?.role ? hasRole(user.role, 'gm_plus') : false;
  
  return (
    <div className="p-6 h-full flex flex-col">
      {/* Hoşgeldin başlığı */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-discord-text mb-2">
          Hoş Geldin, {user?.username || 'Yetkili'}! 👋
        </h1>
        <p className="text-discord-muted">
          SANIYE MODLARI Saniye Yetkili Kılavuzu ve Ceza Danışman Sistemi
        </p>
      </div>

      {/* Hızlı erişim kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <QuickAccessCard
          icon={<Book className="h-6 w-6" />}
          title="Saniye Yetkili Kılavuzu"
          description="Moderasyon kuralları ve prosedürler"
          href="/guide"
          color="accent"
          canEdit={canEdit}
          onAdd={() => router.push('/guide?add=true' as Parameters<typeof router.push>[0])}
        />
        <QuickAccessCard
          icon={<Gavel className="h-6 w-6" />}
          title="Cezalar"
          description="Ceza türleri ve süreleri"
          href="/penalties"
          color="red"
          canEdit={canEdit}
          onAdd={() => router.push('/penalties?add=true' as Parameters<typeof router.push>[0])}
        />
        <QuickAccessCard
          icon={<Terminal className="h-6 w-6" />}
          title="Komutlar"
          description="Bot komutları ve kullanımları"
          href="/commands"
          color="green"
          canEdit={canEdit}
          onAdd={() => router.push('/commands?add=true' as Parameters<typeof router.push>[0])}
        />
        <QuickAccessCard
          icon={<FileText className="h-6 w-6" />}
          title="Prosedürler"
          description="İşlem adımları ve yönergeler"
          href="/procedures"
          color="yellow"
          canEdit={canEdit}
          onAdd={() => router.push('/procedures?add=true' as Parameters<typeof router.push>[0])}
        />
        <QuickAccessCard
          icon={<Shield className="h-6 w-6" />}
          title="Yetki Bilgisi"
          description={`Mevcut yetkiniz: ${getRoleLabel(user?.role ?? undefined)}`}
          color="muted"
        />
      </div>

      {/* Bilgi kartı */}
      <div className="mt-auto">
        <div className="bg-discord-light rounded-lg p-4 border border-discord-lighter">
          <h3 className="text-sm font-semibold text-discord-text mb-2">
            💡 İpucu
          </h3>
          <p className="text-sm text-discord-muted">
            Hızlı arama için <kbd className="px-1.5 py-0.5 bg-discord-darker rounded text-xs">⌘K</kbd> veya{' '}
            <kbd className="px-1.5 py-0.5 bg-discord-darker rounded text-xs">Ctrl+K</kbd> kısayolunu kullanabilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}

// Rol etiketini al
function getRoleLabel(role?: string): string {
  const labels: Record<string, string> = {
    none: 'Kullanıcı',
    reg: 'Regülatör',
    op: 'Operatör',
    gk: 'GateKeeper',
    council: 'Council',
    gm: 'GM',
    gm_plus: '🔖 GM+',
    owner: 'Owner',
    // Eski roller (geriye uyumluluk)
    mod: 'Moderatör',
    admin: 'Admin',
    ust_yetkili: 'Üst Yetkili',
  };
  return labels[role || 'none'] || 'Kullanıcı';
}

// Hızlı erişim kartı bileşeni
interface QuickAccessCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  color: 'accent' | 'red' | 'green' | 'yellow' | 'muted';
  canEdit?: boolean;
  onAdd?: () => void;
}

function QuickAccessCard({
  icon,
  title,
  description,
  href,
  onClick,
  color,
  canEdit,
  onAdd,
}: QuickAccessCardProps): React.ReactElement {
  const router = useRouter();
  
  const colorClasses = {
    accent: 'bg-discord-accent/10 text-discord-accent hover:bg-discord-accent/20',
    red: 'bg-discord-red/10 text-discord-red hover:bg-discord-red/20',
    green: 'bg-discord-green/10 text-discord-green hover:bg-discord-green/20',
    yellow: 'bg-discord-yellow/10 text-discord-yellow hover:bg-discord-yellow/20',
    muted: 'bg-discord-light text-discord-muted',
  };

  const handleClick = (): void => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href as Parameters<typeof router.push>[0]);
    }
  };

  const handleAddClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onAdd) {
      onAdd();
    }
  };

  const isClickable = href || onClick;

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`
        p-4 rounded-lg border border-discord-lighter transition-all relative group
        ${isClickable ? 'cursor-pointer hover:border-discord-accent/50' : ''}
        ${colorClasses[color]}
      `}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-discord-text text-sm mb-1">
            {title}
          </h3>
          <p className="text-xs text-discord-muted">{description}</p>
        </div>
        {/* Yeni Ekle butonu - sadece gm_plus ve owner için */}
        {canEdit && onAdd && (
          <button
            onClick={handleAddClick}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-discord-green/20 hover:bg-discord-green/30 text-discord-green"
            title="Yeni Ekle"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Ana sayfa bileşeni
export default function HomePage(): React.ReactElement {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  
  // Seçili içerik state
  const [selectedContent, setSelectedContent] = useState<GuideContent | null>(null);

  // Kılavuz içeriğini yükle
  const guideContent = useMemo(() => loadGuideContent(), []);

  // Yükleniyor durumu
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-discord-darker">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          <span className="text-discord-muted">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  // Giriş yapmamış kullanıcılar için landing page
  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-discord-darker">
        <div className="max-w-md text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-discord-accent/20 flex items-center justify-center">
              <Shield className="w-10 h-10 text-discord-accent" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-discord-text mb-4">
            Saniye Yetkili Kılavuzu
          </h1>
          <p className="text-discord-muted mb-8">
            SANIYE MODLARI Discord sunucusu için Saniye Yetkili Kılavuzu ve Ceza Danışman Sistemi
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/login"
              className="px-6 py-3 bg-discord-accent text-white rounded-lg font-medium hover:bg-discord-accent/90 transition-colors"
            >
              Giriş Yap
            </a>
            <a
              href="/register"
              className="px-6 py-3 bg-discord-light text-discord-text rounded-lg font-medium hover:bg-discord-lighter transition-colors"
            >
              Kayıt Ol
            </a>
          </div>
          
          {/* Aderimo imzası */}
          <p className="mt-12 text-xs text-discord-muted/70">
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
      </main>
    );
  }

  // Beklemede durumundaki kullanıcıları yönlendir
  if (user?.status === 'pending') {
    router.push('/pending');
    return (
      <div className="flex h-screen items-center justify-center bg-discord-darker">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
      </div>
    );
  }

  // Reddedilmiş kullanıcıları yönlendir
  if (user?.status === 'rejected') {
    router.push('/unauthorized');
    return (
      <div className="flex h-screen items-center justify-center bg-discord-darker">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
      </div>
    );
  }

  // Navigasyon için içerik seçimi
  const handleContentSelect = (content: GuideContent): void => {
    setSelectedContent(content);
  };

  // Önceki ve sonraki içerik
  const currentIndex = selectedContent
    ? guideContent.findIndex((c) => c.id === selectedContent.id)
    : -1;
  const prevContent = currentIndex > 0 ? guideContent[currentIndex - 1] : null;
  const nextContent = currentIndex < guideContent.length - 1 ? guideContent[currentIndex + 1] : null;

  return (
    <MainLayout sidebar={<Sidebar />}>
      {selectedContent ? (
        <ContentViewer
          type="guide"
          content={selectedContent}
          prevContent={
            prevContent
              ? { title: prevContent.title, href: `/guide/${prevContent.slug}` }
              : null
          }
          nextContent={
            nextContent
              ? { title: nextContent.title, href: `/guide/${nextContent.slug}` }
              : null
          }
          onNavigate={(href) => {
            const slug = href.split('/').pop();
            const content = guideContent.find((c) => c.slug === slug);
            if (content) {
              handleContentSelect(content);
            }
          }}
          userId={user?.id}
        />
      ) : (
        <WelcomeCard />
      )}
    </MainLayout>
  );
}
