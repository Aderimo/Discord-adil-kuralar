'use client';

import React, { useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { ContentViewer } from '@/components/content/ContentViewer';
import { BackButton } from '@/components/navigation/BackButton';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { loadProcedures } from '@/lib/content';

export default function ProcedureSlugClient() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const procedures = loadProcedures();
  const procedure = procedures.find(p => p.slug === slug);

  const breadcrumbItems = useMemo(() => [
    { label: 'Ana Sayfa', href: '/' },
    { label: 'Prosedürler', href: '/procedures' },
    { label: procedure?.title || slug, href: `/procedures/${slug}` },
  ], [procedure?.title, slug]);

  if (!procedure) {
    return (
      <MainLayout sidebar={<Sidebar />}>
        <div className="flex items-center justify-center h-full">
          <p className="text-discord-muted">Prosedür bulunamadı.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout sidebar={<Sidebar />}>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6 space-y-3">
          <BackButton fallbackUrl="/procedures" label="Geri" />
          <Breadcrumb items={breadcrumbItems} />
        </div>
        <ContentViewer type="procedure" content={procedure} />
      </div>
    </MainLayout>
  );
}
