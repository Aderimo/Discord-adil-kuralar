// GET /api/admin/settings - Rol izin ayarlarını getir
// PUT /api/admin/settings - Rol izin ayarlarını kaydet

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSuperAdmin } from '@/lib/api-auth';

const SETTINGS_KEY = 'role_permissions';

async function ensureTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS site_settings (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

interface SettingsRow {
  key: string;
  value: string;
}

export const GET = withSuperAdmin<{ success: boolean; permissions?: Record<string, string>; error?: string }>(
  async () => {
    try {
      await ensureTable();
      const rows = await prisma.$queryRaw<SettingsRow[]>`
        SELECT key, value FROM site_settings WHERE key = ${SETTINGS_KEY}
      `;
      if (rows.length === 0) {
        return NextResponse.json({ success: true, permissions: null });
      }
      const permissions = JSON.parse(rows[0].value) as Record<string, string>;
      return NextResponse.json({ success: true, permissions });
    } catch (error) {
      console.error('Settings GET error:', error);
      return NextResponse.json({ success: false, error: 'Ayarlar yüklenemedi' }, { status: 500 });
    }
  }
);

export const PUT = withSuperAdmin<{ success: boolean; error?: string }>(
  async (request: NextRequest) => {
    try {
      await ensureTable();
      const body = await request.json() as { permissions: Record<string, string> };
      if (!body.permissions || typeof body.permissions !== 'object') {
        return NextResponse.json({ success: false, error: 'Geçersiz veri' }, { status: 400 });
      }
      const value = JSON.stringify(body.permissions);
      await prisma.$executeRaw`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (${SETTINGS_KEY}, ${value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
      `;
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Settings PUT error:', error);
      return NextResponse.json({ success: false, error: 'Ayarlar kaydedilemedi' }, { status: 500 });
    }
  }
);
