'use client';

// Admin Settings Page - Placeholder
// Bu sayfa gelecekte sistem ayarları için kullanılacak

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Construction } from 'lucide-react';

export default function SettingsPage(): React.ReactElement {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-discord-text">Ayarlar</h1>
        <p className="text-discord-muted mt-1">
          Sistem ayarlarını yönetin
        </p>
      </div>

      {/* Placeholder Card */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sistem Ayarları
          </CardTitle>
          <CardDescription>
            Genel sistem yapılandırması
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="h-16 w-16 text-discord-yellow mb-4" />
            <p className="text-discord-text font-medium text-lg">Yapım Aşamasında</p>
            <p className="text-discord-muted text-sm mt-2 max-w-md">
              Bu bölüm henüz geliştirme aşamasındadır. Yakında sistem ayarları,
              bildirim tercihleri ve diğer yapılandırma seçenekleri burada yer alacak.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
