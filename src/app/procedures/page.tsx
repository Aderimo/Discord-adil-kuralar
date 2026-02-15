'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadProcedures } from '@/lib/content';
import { Input } from '@/components/ui/input';
import { FileText, ChevronRight, Search } from 'lucide-react';

export default function ProceduresPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const allProcedures = loadProcedures();
  const procedures = useMemo(() => {
    if (!searchQuery.trim()) return allProcedures;
    const q = searchQuery.toLowerCase();
    return allProcedures.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [allProcedures, searchQuery]);

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="space-y-3">
          <BackButton fallbackUrl="/" label="Geri" />
          <Breadcrumb items={[{ label: 'Ana Sayfa', href: '/' }, { label: 'Prosedürler', href: '/procedures' }]} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-discord-text mb-2">Prosedürler</h1>
          <p className="text-discord-muted">İşlem adımları ve yönergeler.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
          <Input type="text" placeholder="Prosedür ara..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-discord-dark border-discord-light" />
        </div>
        <div className="space-y-3">
          {procedures.map(proc => (
            <Link key={proc.id} href={`/procedures/${proc.slug}`}
              className="block bg-discord-dark border border-discord-light rounded-lg p-4 hover:border-discord-accent/50 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-discord-yellow/10 rounded-lg">
                    <FileText className="h-5 w-5 text-discord-yellow" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-discord-text group-hover:text-discord-accent transition-colors">{proc.title}</h3>
                    <p className="text-sm text-discord-muted">{proc.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-discord-muted group-hover:text-discord-accent transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
