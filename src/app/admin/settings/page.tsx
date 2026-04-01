'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, Save, RotateCcw, Check, X, Lock } from 'lucide-react';
import type { UserRole } from '@/types';
import { ROLE_HIERARCHY } from '@/lib/rbac';

// ── Özellik tanımları ────────────────────────────────────────────────────────

interface Feature {
  key: string;
  label: string;
  description: string;
  group: string;
  defaultMinRole: UserRole;
}

const FEATURES: Feature[] = [
  // İçerik
  { key: 'view_guide',      label: 'Kılavuzu Görüntüle',       description: 'Yetkili kılavuzunu okuyabilir',          group: 'İçerik',        defaultMinRole: 'reg' },
  { key: 'view_penalties',  label: 'Cezaları Görüntüle',       description: 'Ceza listesine bakabilir',               group: 'İçerik',        defaultMinRole: 'reg' },
  { key: 'view_commands',   label: 'Komutları Görüntüle',      description: 'Bot komutlarını görebilir',              group: 'İçerik',        defaultMinRole: 'reg' },
  { key: 'view_procedures', label: 'Prosedürleri Görüntüle',   description: 'Prosedür sayfalarına erişebilir',        group: 'İçerik',        defaultMinRole: 'reg' },
  { key: 'view_templates',  label: 'Şablonları Görüntüle',     description: 'Ceza şablonlarını kopyalayabilir',       group: 'İçerik',        defaultMinRole: 'reg' },
  { key: 'edit_content',    label: 'İçerik Düzenle',           description: 'Kılavuz ve prosedür içeriğini değiştirebilir', group: 'İçerik', defaultMinRole: 'gm' },

  // AI
  { key: 'use_ai',          label: 'AI Danışman Kullan',       description: 'AI sohbet arayüzünü kullanabilir',       group: 'AI',            defaultMinRole: 'reg' },

  // Admin
  { key: 'view_admin',      label: 'Admin Paneli Görsün',      description: 'Sidebar\'da Admin Paneli linki görünür', group: 'Yönetim',       defaultMinRole: 'ust_yetkili' },
  { key: 'manage_users',    label: 'Kullanıcı Yönetimi',       description: 'Kullanıcıları onaylayabilir ve rol atayabilir', group: 'Yönetim', defaultMinRole: 'ust_yetkili' },
  { key: 'view_logs',       label: 'Aktivite Loglarını Gör',   description: 'Log geçmişine erişebilir',               group: 'Yönetim',       defaultMinRole: 'owner' },
  { key: 'clear_logs',      label: 'Logları Temizle',          description: 'Tüm aktivite loglarını silebilir',       group: 'Yönetim',       defaultMinRole: 'owner' },
  { key: 'manage_settings', label: 'Ayarları Yönet',           description: 'Rol izinlerini ve sistem ayarlarını değiştirebilir', group: 'Yönetim', defaultMinRole: 'owner' },
];

// Rol listesi (hiyerarşik sıra)
const DISPLAY_ROLES: { role: UserRole; label: string; color: string }[] = [
  { role: 'reg',         label: 'Reg',          color: 'text-zinc-400' },
  { role: 'op',          label: 'Operatör',     color: 'text-green-400' },
  { role: 'gatekeeper',  label: 'GateKeeper',   color: 'text-green-300' },
  { role: 'council',     label: 'Council',      color: 'text-blue-400' },
  { role: 'gm',          label: 'GM',           color: 'text-discord-accent' },
  { role: 'ust_yetkili', label: 'Üst Yetkili',  color: 'text-yellow-400' },
  { role: 'owner',       label: 'Owner',        color: 'text-yellow-300' },
];

type PermissionMap = Record<string, UserRole>;

function buildDefault(): PermissionMap {
  const map: PermissionMap = {};
  FEATURES.forEach(f => { map[f.key] = f.defaultMinRole; });
  return map;
}

// A role has access if its level >= the feature's minRole level
function roleHasAccess(role: UserRole, minRole: UserRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

const FEATURE_GROUPS = Array.from(new Set(FEATURES.map(f => f.group)));

export default function SettingsPage(): React.ReactElement {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PermissionMap>(buildDefault);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  React.useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then(r => r.json())
      .then((data: { success: boolean; permissions?: Record<string, string> | null }) => {
        if (data.success && data.permissions) {
          setPermissions({ ...buildDefault(), ...data.permissions });
        }
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setIsLoading(false));
  }, []);

  const isOwner = user?.role === 'ust_yetkili' || user?.role === 'owner';

  // Toggle: if role already has access, raise the minRole to just above this role.
  //         if role doesn't have access, lower minRole to this role.
  const handleToggle = (featureKey: string, role: UserRole) => {
    if (!isOwner) return;
    setPermissions(prev => {
      const current = prev[featureKey] ?? 'reg';
      let newMin: UserRole;
      if (roleHasAccess(role, current)) {
        // Currently allowed → find the next role above to restrict
        const roleLevel = ROLE_HIERARCHY[role] ?? 0;
        const nextRole = DISPLAY_ROLES.find(r => (ROLE_HIERARCHY[r.role] ?? 0) > roleLevel);
        newMin = nextRole ? nextRole.role : 'owner';
      } else {
        // Currently denied → allow from this role
        newMin = role;
      }
      setHasChanges(true);
      return { ...prev, [featureKey]: newMin };
    });
  };

  const handleReset = () => {
    setPermissions(buildDefault());
    setHasChanges(false);
    toast({ title: 'Sıfırlandı', description: 'İzinler varsayılan değerlere döndürüldü' });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setHasChanges(false);
        toast({ title: 'Kaydedildi', description: 'Rol izinleri güncellendi' });
      } else {
        toast({ title: 'Hata', description: data.error || 'Kaydedilemedi', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Bağlantı Hatası', description: 'Sunucuya bağlanılamadı', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-discord-accent/20">
            <Shield className="h-5 w-5 text-discord-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-discord-text">Rol İzin Ayarları</h1>
            <p className="text-xs text-discord-muted">Her rol için hangi özelliklerin aktif olduğunu ayarlayın</p>
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button variant="secondary" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Sıfırla
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="bg-discord-accent hover:bg-discord-accent/90"
            >
              {isSaving ? (
                <><Save className="h-4 w-4 mr-1.5 animate-spin" /> Kaydediliyor...</>
              ) : (
                <><Save className="h-4 w-4 mr-1.5" /> Kaydet</>
              )}
            </Button>
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>Bu sayfayı yalnızca <strong>Owner</strong> ve <strong>Üst Yetkili</strong> düzenleyebilir. Salt okunur görünüm.</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-discord-muted">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-discord-accent/20 border border-discord-accent/40">
            <Check className="h-3 w-3 text-discord-accent" />
          </div>
          <span>Bu rol erişebilir</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-discord-darker border border-discord-lighter">
            <X className="h-3 w-3 text-discord-muted" />
          </div>
          <span>Bu rol erişemez</span>
        </div>
        <span className="text-discord-muted">· Bir kutucuğa tıklayarak minimum rolü değiştirebilirsiniz</span>
      </div>

      {/* Permission Matrix per group */}
      {FEATURE_GROUPS.map(group => (
        <Card key={group} className="bg-discord-dark border-discord-light overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4 sm:px-5">
            <CardTitle className="text-sm font-semibold text-discord-text">{group}</CardTitle>
            <CardDescription className="text-xs">Özelliklere göre erişim kontrolü</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-discord-lighter">
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-medium text-discord-muted min-w-[180px]">
                      Özellik
                    </th>
                    {DISPLAY_ROLES.map(({ role, label, color }) => (
                      <th key={role} className="px-2 py-3 text-center min-w-[70px]">
                        <span className={`text-[11px] font-medium ${color}`}>{label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-discord-lighter">
                  {FEATURES.filter(f => f.group === group).map(feature => {
                    const minRole = permissions[feature.key] ?? feature.defaultMinRole;
                    return (
                      <tr key={feature.key} className="hover:bg-discord-lighter/20 transition-colors">
                        <td className="px-4 sm:px-5 py-3">
                          <p className="text-sm text-discord-text font-medium">{feature.label}</p>
                          <p className="text-xs text-discord-muted mt-0.5">{feature.description}</p>
                        </td>
                        {DISPLAY_ROLES.map(({ role }) => {
                          const hasAccess = roleHasAccess(role, minRole);
                          return (
                            <td key={role} className="px-2 py-3 text-center">
                              <button
                                onClick={() => handleToggle(feature.key, role)}
                                disabled={!isOwner}
                                title={hasAccess ? `${role} erişebilir — kısıtlamak için tıkla` : `${role} erişemez — izin vermek için tıkla`}
                                className={`
                                  mx-auto flex h-6 w-6 items-center justify-center rounded transition-all
                                  ${hasAccess
                                    ? 'bg-discord-accent/20 border border-discord-accent/50 hover:bg-discord-accent/30'
                                    : 'bg-discord-darker border border-discord-lighter hover:border-discord-light'
                                  }
                                  ${!isOwner ? 'cursor-default' : 'cursor-pointer'}
                                `}
                              >
                                {hasAccess
                                  ? <Check className="h-3.5 w-3.5 text-discord-accent" />
                                  : <X className="h-3.5 w-3.5 text-discord-muted opacity-40" />
                                }
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Min role summary row */}
            <div className="border-t border-discord-lighter px-4 sm:px-5 py-2.5 flex gap-2 flex-wrap text-xs text-discord-muted bg-discord-darker/50">
              {FEATURES.filter(f => f.group === group).map(feature => {
                const minRole = permissions[feature.key] ?? feature.defaultMinRole;
                const roleInfo = DISPLAY_ROLES.find(r => r.role === minRole);
                return (
                  <span key={feature.key} className="flex items-center gap-1">
                    <span className="text-discord-muted">{feature.label}:</span>
                    <span className={`font-medium ${roleInfo?.color ?? 'text-discord-text'}`}>
                      {roleInfo?.label ?? minRole}+
                    </span>
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
