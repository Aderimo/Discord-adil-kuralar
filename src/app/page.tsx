'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { getContentStats } from '@/lib/content';
import { Book, Gavel, Terminal, FileText } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const stats = getContentStats();

  const sections = [
    { icon: Book, label: 'Kılavuz', count: stats.guideCount, href: '/guide', color: 'text-blue-400' },
    { icon: Gavel, label: 'Cezalar', count: stats.penaltyCount, href: '/penalties', color: 'text-red-400' },
    { icon: Terminal, label: 'Komutlar', count: stats.commandCount, href: '/commands', color: 'text-green-400' },
    { icon: FileText, label: 'Prosedürler', count: stats.procedureCount, href: '/procedures', color: 'text-yellow-400' },
  ];

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-discord-text mb-2">
            Saniye Yetkili Kılavuzu
          </h1>
          <p className="text-discord-muted">
            SANIYE MODLARI Discord sunucusu için yetkili rehberi
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sections.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-discord-light rounded-lg p-4 hover:bg-discord-lighter transition-colors group"
            >
              <s.icon className={`h-8 w-8 ${s.color} mb-3 group-hover:scale-110 transition-transform`} />
              <p className="text-2xl font-bold text-discord-text">{s.count}</p>
              <p className="text-sm text-discord-muted">{s.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
