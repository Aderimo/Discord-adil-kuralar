'use client';

/**
 * Rol Yönetimi Sayfası
 * Rolleri görüntüleme, oluşturma, düzenleme ve silme
 *
 * Requirement: Dinamik rol yönetim sistemi
 * Sadece owner erişebilir
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  Shield,
  Plus,
  Edit,
  Trash2,
  Lock,
  RefreshCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Role, Permission } from '@/types';

// İzin açıklamaları
const PERMISSION_LABELS: Record<Permission, string> = {
  VIEW_CONTENT: 'İçerik Görüntüleme',
  EDIT_CONTENT: 'İçerik Düzenleme',
  DELETE_CONTENT: 'İçerik Silme',
  VIEW_USERS: 'Kullanıcı Listesi',
  EDIT_USERS: 'Kullanıcı Düzenleme',
  DELETE_USERS: 'Kullanıcı Silme',
  VIEW_LOGS: 'Log Görüntüleme',
  VIEW_NOTIFICATIONS: 'Bildirim Görüntüleme',
  EDIT_TEMPLATES: 'Şablon Düzenleme',
  MANAGE_ROLES: 'Rol Yönetimi',
};

const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

// Varsayılan form değerleri
const DEFAULT_FORM_VALUES = {
  code: '',
  name: '',
  shortName: '',
  description: '',
  hierarchy: 1,
  color: '#5865F2',
  permissions: [] as string[],
};

export default function SettingsPage(): React.ReactElement {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_VALUES);
  const [isSaving, setIsSaving] = useState(false);

  // Rolleri yükle
  const loadRoles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/roles');
      const data = await response.json();

      if (data.success) {
        setRoles(data.roles);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Roller yüklenemedi',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Roller yüklenemedi:', error);
      toast({
        title: 'Hata',
        description: 'Roller yüklenirken bir hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Yeni rol ekleme modalını aç
  const handleAddRole = () => {
    setEditingRole(null);
    setFormData({
      ...DEFAULT_FORM_VALUES,
      hierarchy: Math.max(...roles.map((r) => r.hierarchy), 0) + 1,
    });
    setIsDialogOpen(true);
  };

  // Rol düzenleme modalını aç
  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      code: role.code,
      name: role.name,
      shortName: role.shortName,
      description: role.description,
      hierarchy: role.hierarchy,
      color: role.color,
      permissions: role.permissions,
    });
    setIsDialogOpen(true);
  };

  // Rol silme onayı
  const handleDeleteClick = (role: Role) => {
    setDeletingRole(role);
    setIsDeleteDialogOpen(true);
  };

  // Form kaydet
  const handleSave = async () => {
    try {
      setIsSaving(true);

      const url = editingRole
        ? `/api/admin/roles/${editingRole.id}`
        : '/api/admin/roles';

      const method = editingRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: editingRole
            ? 'Rol başarıyla güncellendi'
            : 'Rol başarıyla oluşturuldu',
        });
        setIsDialogOpen(false);
        loadRoles();
      } else {
        toast({
          title: 'Hata',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Rol kaydedilemedi:', error);
      toast({
        title: 'Hata',
        description: 'Rol kaydedilirken bir hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Rol sil
  const handleDelete = async () => {
    if (!deletingRole) return;

    try {
      const response = await fetch(`/api/admin/roles/${deletingRole.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: 'Rol başarıyla silindi',
        });
        setIsDeleteDialogOpen(false);
        setDeletingRole(null);
        loadRoles();
      } else {
        toast({
          title: 'Hata',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Rol silinemedi:', error);
      toast({
        title: 'Hata',
        description: 'Rol silinirken bir hata oluştu',
        variant: 'destructive',
      });
    }
  };

  // İzin toggle
  const togglePermission = (permission: Permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-discord-text">Rol Yönetimi</h1>
          <p className="text-discord-muted mt-1">
            Sistem rollerini görüntüleyin ve yönetin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRoles}
            disabled={isLoading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Yenile
          </Button>
          <Button onClick={handleAddRole}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Rol
          </Button>
        </div>
      </div>

      {/* Rol Listesi */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Roller
          </CardTitle>
          <CardDescription>
            Toplam {roles.length} rol tanımlanmış
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord-accent" />
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-discord-darker border border-discord-light"
                >
                  <div className="flex items-center gap-4">
                    {/* Renk göstergesi */}
                    <div
                      className="w-3 h-10 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />

                    {/* Rol bilgileri */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-discord-text">
                          {role.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-discord-light text-discord-muted">
                          {role.shortName}
                        </span>
                        {role.isSystem && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-discord-accent/20 text-discord-accent">
                            <Lock className="h-3 w-3" />
                            Sistem
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-discord-muted mt-1 line-clamp-1 max-w-lg">
                        {role.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-discord-muted">
                          Kod: <code className="bg-discord-light px-1 rounded">{role.code}</code>
                        </span>
                        <span className="text-xs text-discord-muted">
                          Hiyerarşi: {role.hierarchy}
                        </span>
                        <span className="text-xs text-discord-muted">
                          İzinler: {role.permissions.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Aksiyon butonları */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRole(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        onClick={() => handleDeleteClick(role)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rol Oluşturma/Düzenleme Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-discord-dark border-discord-light max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {editingRole ? 'Rol Düzenle' : 'Yeni Rol Oluştur'}
            </DialogTitle>
            <DialogDescription>
              Rol bilgilerini ve izinlerini yapılandırın
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Temel Bilgiler */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Rol Kodu</Label>
                <Input
                  id="code"
                  placeholder="ornek_rol"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value }))
                  }
                  disabled={!!editingRole}
                  className="bg-discord-darker border-discord-light"
                />
                <p className="text-xs text-discord-muted">
                  Sadece küçük harf ve alt çizgi
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hierarchy">Hiyerarşi Seviyesi</Label>
                <Input
                  id="hierarchy"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.hierarchy}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      hierarchy: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="bg-discord-darker border-discord-light"
                />
                <p className="text-xs text-discord-muted">
                  Daha yüksek = daha yetkili
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Rol Adı</Label>
                <Input
                  id="name"
                  placeholder="Örnek Rol"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="bg-discord-darker border-discord-light"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortName">Kısa Ad</Label>
                <Input
                  id="shortName"
                  placeholder="ÖRN"
                  value={formData.shortName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shortName: e.target.value,
                    }))
                  }
                  className="bg-discord-darker border-discord-light"
                />
              </div>
            </div>

            {/* Renk */}
            <div className="space-y-2">
              <Label htmlFor="color">Rol Rengi</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="w-16 h-10 p-1 bg-discord-darker border-discord-light cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="flex-1 bg-discord-darker border-discord-light"
                />
              </div>
            </div>

            {/* Açıklama */}
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                placeholder="Bu rolün görevleri ve sorumlulukları..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="bg-discord-darker border-discord-light min-h-24"
              />
            </div>

            {/* İzinler */}
            <div className="space-y-3">
              <Label>İzinler</Label>
              <div className="grid grid-cols-2 gap-3">
                {ALL_PERMISSIONS.map((permission) => (
                  <div
                    key={permission}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-discord-darker border border-discord-light"
                  >
                    <Checkbox
                      id={permission}
                      checked={formData.permissions.includes(permission)}
                      onCheckedChange={() => togglePermission(permission)}
                    />
                    <Label
                      htmlFor={permission}
                      className="text-sm cursor-pointer"
                    >
                      {PERMISSION_LABELS[permission]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              İptal
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Kaydet'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-discord-dark border-discord-light">
          <AlertDialogHeader>
            <AlertDialogTitle>Rolü Silmek İstediğinize Emin Misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingRole?.name}</strong> rolü kalıcı olarak silinecek.
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
