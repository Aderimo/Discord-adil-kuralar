'use client';

// Admin Panel - Bekleyen kullanıcılar yönetimi
// Requirement 3.1: Bekleyen kullanıcılar listesi
// Requirement 3.2: Kullanıcı onaylama
// Requirement 3.3: Kullanıcı reddetme
// Requirement 3.4: Yetki seviyesi değiştirme

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, X, ChevronDown, Users, Clock, UserCheck, UserX, RefreshCw } from 'lucide-react';
import type { UserRole } from '@/types';

interface PendingUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  status: string;
}

interface ApiResponse {
  success: boolean;
  users?: PendingUser[];
  count?: number;
  message?: string;
  error?: string;
}

const ROLE_LABELS: Record<string, string> = {
  mod: 'Moderatör',
  admin: 'Admin',
  ust_yetkili: 'Üst Yetkili',
};

export default function AdminPage(): React.ReactElement {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('mod');
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Bekleyen kullanıcıları getir
  const fetchPendingUsers = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch('/api/admin/users/pending', {
        credentials: 'include',
      });
      const data: ApiResponse = await response.json();

      if (data.success && data.users) {
        setPendingUsers(data.users);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Kullanıcılar yüklenemedi',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: 'Bağlantı Hatası',
        description: 'Sunucuya bağlanılamadı',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  // Kullanıcı onaylama
  const handleApprove = async (): Promise<void> => {
    if (!selectedUser) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: `${selectedUser.username} kullanıcısı ${ROLE_LABELS[selectedRole]} olarak onaylandı`,
          variant: 'success',
        });
        setPendingUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
        setIsApproveDialogOpen(false);
        setSelectedUser(null);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Onaylama işlemi başarısız',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast({
        title: 'Bağlantı Hatası',
        description: 'İşlem gerçekleştirilemedi',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Kullanıcı reddetme
  const handleReject = async (): Promise<void> => {
    if (!selectedUser) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: `${selectedUser.username} kullanıcısının başvurusu reddedildi`,
          variant: 'warning',
        });
        setPendingUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
        setIsRejectDialogOpen(false);
        setSelectedUser(null);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Reddetme işlemi başarısız',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Reject error:', error);
      toast({
        title: 'Bağlantı Hatası',
        description: 'İşlem gerçekleştirilemedi',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Tarih formatla
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Onaylama dialog'unu aç
  const openApproveDialog = (user: PendingUser): void => {
    setSelectedUser(user);
    setSelectedRole('mod');
    setIsApproveDialogOpen(true);
  };

  // Reddetme dialog'unu aç
  const openRejectDialog = (user: PendingUser): void => {
    setSelectedUser(user);
    setIsRejectDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          <p className="text-discord-muted">Kullanıcılar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-discord-text">Bekleyen Kullanıcılar</h1>
          <p className="text-discord-muted mt-1 text-sm sm:text-base">
            Onay bekleyen kullanıcı başvurularını yönetin
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchPendingUsers(true)}
          disabled={isRefreshing}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-discord-light border-discord-lighter">
          <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-discord-accent/20">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-discord-accent" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-discord-text">{pendingUsers.length}</p>
              <p className="text-xs sm:text-sm text-discord-muted">Bekleyen Başvuru</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-discord-light border-discord-lighter">
          <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-discord-green/20">
              <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-discord-green" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-discord-text">-</p>
              <p className="text-xs sm:text-sm text-discord-muted">Bugün Onaylanan</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-discord-light border-discord-lighter sm:col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-discord-red/20">
              <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-discord-red" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-discord-text">-</p>
              <p className="text-xs sm:text-sm text-discord-muted">Bugün Reddedilen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Başvuru Listesi
          </CardTitle>
          <CardDescription>
            Kullanıcıları onaylayarak yetki seviyesi atayabilir veya başvuruları reddedebilirsiniz
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-discord-muted mb-4" />
              <p className="text-discord-text font-medium">Bekleyen başvuru yok</p>
              <p className="text-discord-muted text-sm mt-1">
                Tüm başvurular işlenmiş görünüyor
              </p>
            </div>
          ) : (
            <>
              {/* Mobil Kart Görünümü */}
              <div className="block md:hidden space-y-3">
                {pendingUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className="bg-discord-darker rounded-lg p-4 border border-discord-lighter"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-accent text-sm font-bold text-white">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-discord-text">{user.username}</p>
                          <p className="text-xs text-discord-muted">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-discord-muted mb-3">
                      Kayıt: {formatDate(user.createdAt)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => openApproveDialog(user)}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Onayla
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openRejectDialog(user)}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reddet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Masaüstü Tablo Görünümü */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-discord-lighter">
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">
                        Kullanıcı
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">
                        E-posta
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">
                        Kayıt Tarihi
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-discord-muted">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-discord-lighter">
                    {pendingUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-discord-lighter/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-discord-accent text-sm font-bold text-white">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-discord-text">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-discord-muted">{user.email}</td>
                        <td className="px-4 py-3 text-discord-muted">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => openApproveDialog(user)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Onayla
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openRejectDialog(user)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reddet
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcıyı Onayla</DialogTitle>
            <DialogDescription>
              <strong>{selectedUser?.username}</strong> kullanıcısını onaylamak üzeresiniz.
              Lütfen atanacak yetki seviyesini seçin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-discord-text mb-2 block">
              Yetki Seviyesi
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {ROLE_LABELS[selectedRole]}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedRole('mod')}>
                  Moderatör
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('admin')}>
                  Admin
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('ust_yetkili')}>
                  Üst Yetkili
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={isProcessing}
            >
              İptal
            </Button>
            <Button
              variant="success"
              onClick={handleApprove}
              disabled={isProcessing}
            >
              {isProcessing ? 'İşleniyor...' : 'Onayla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Başvuruyu Reddet</DialogTitle>
            <DialogDescription>
              <strong>{selectedUser?.username}</strong> kullanıcısının başvurusunu reddetmek
              istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
            >
              {isProcessing ? 'İşleniyor...' : 'Reddet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
