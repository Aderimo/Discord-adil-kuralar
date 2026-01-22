'use client';

// Admin Panel - Gelişmiş Kullanıcı Yönetimi
// Requirement 5.1: Tüm kullanıcılar listesi (pending, approved, rejected)
// Requirement 5.4: Yetki değiştir dropdown
// Requirement 5.7: Kullanıcı sayısı istatistikleri
// Requirement 11.7: Dinamik rol atama

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  Check,
  X,
  ChevronDown,
  Users,
  Clock,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  Filter,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import type { UserRole, UserStatus, Role } from '@/types';

interface User {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  role: UserRole | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface ApiResponse {
  success: boolean;
  users?: User[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  message?: string;
  error?: string;
}

// Varsayılan rol etiketleri (dinamik roller yüklenene kadar)
const DEFAULT_ROLE_LABELS: Record<string, string> = {
  none: 'Yok',
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylı',
  rejected: 'Reddedildi',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

interface UserFilters {
  search: string;
  status: UserStatus | 'all';
  role: UserRole | 'all';
}

export default function AdminPage(): React.ReactElement {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>(DEFAULT_ROLE_LABELS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('reg');
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isRoleChangeDialogOpen, setIsRoleChangeDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject'>('approve');
  const { toast } = useToast();

  // Filtreleme state'leri
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    status: 'all',
    role: 'all',
  });

  // Pagination state'leri
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  // İstatistikler
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  // Rolleri yükle - Requirement 11.7
  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/roles', {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success && data.roles) {
        setRoles(data.roles);
        // Rol etiketlerini güncelle
        const labels: Record<string, string> = { ...DEFAULT_ROLE_LABELS };
        data.roles.forEach((role: Role) => {
          labels[role.code] = role.name;
        });
        setRoleLabels(labels);
      }
    } catch (error) {
      console.error('Roller yüklenemedi:', error);
    }
  }, []);

  // Kullanıcıları getir
  const fetchUsers = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.role !== 'all') params.set('role', filters.role);
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: 'include',
      });
      const data: ApiResponse = await response.json();

      if (data.success && data.users) {
        setUsers(data.users);
        if (data.pagination) {
          setPagination(data.pagination);
        }
        if (data.stats) {
          setStats(data.stats);
        }
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
  }, [filters, pagination.page, pagination.pageSize, toast]);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [fetchRoles, fetchUsers]);

  // Arama debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Kullanıcı onaylama
  const handleApprove = async (): Promise<void> => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: `${selectedUser.username} kullanıcısı ${roleLabels[selectedRole] || selectedRole} olarak onaylandı`,
          variant: 'success',
        });
        fetchUsers();
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
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: `${selectedUser.username} kullanıcısının başvurusu reddedildi`,
          variant: 'warning',
        });
        fetchUsers();
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

  // Yetki değiştirme - Requirement 5.4
  const handleRoleChange = async (): Promise<void> => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: `${selectedUser.username} kullanıcısının yetkisi ${roleLabels[selectedRole] || selectedRole} olarak değiştirildi`,
          variant: 'success',
        });
        fetchUsers();
        setIsRoleChangeDialogOpen(false);
        setSelectedUser(null);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Yetki değiştirme işlemi başarısız',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Role change error:', error);
      toast({
        title: 'Bağlantı Hatası',
        description: 'İşlem gerçekleştirilemedi',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Toplu işlem - Requirement 5.5
  const handleBulkAction = async (): Promise<void> => {
    if (selectedUserIds.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userIds: Array.from(selectedUserIds),
          action: bulkAction,
          role: bulkAction === 'approve' ? selectedRole : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: data.message,
          variant: 'success',
        });
        fetchUsers();
        setSelectedUserIds(new Set());
        setIsBulkDialogOpen(false);
      } else {
        toast({
          title: 'Kısmi Başarı',
          description: data.message,
          variant: 'warning',
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      toast({
        title: 'Bağlantı Hatası',
        description: 'İşlem gerçekleştirilemedi',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Checkbox toggle
  const toggleUserSelection = (userId: string): void => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Tümünü seç/kaldır
  const toggleSelectAll = (): void => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
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

  // Dialog açma fonksiyonları
  const openApproveDialog = (user: User): void => {
    setSelectedUser(user);
    setSelectedRole('mod');
    setIsApproveDialogOpen(true);
  };

  const openRejectDialog = (user: User): void => {
    setSelectedUser(user);
    setIsRejectDialogOpen(true);
  };

  const openBulkDialog = (action: 'approve' | 'reject'): void => {
    setBulkAction(action);
    setSelectedRole('mod');
    setIsBulkDialogOpen(true);
  };

  // Pending kullanıcıları filtrele (bulk işlem için)
  const pendingSelectedCount = Array.from(selectedUserIds).filter(
    id => users.find(u => u.id === id)?.status === 'pending'
  ).length;

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
          <h1 className="text-xl sm:text-2xl font-bold text-discord-text">Kullanıcı Yönetimi</h1>
          <p className="text-discord-muted mt-1 text-sm sm:text-base">
            Tüm kullanıcıları görüntüleyin ve yönetin
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchUsers(true)}
          disabled={isRefreshing}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Stats Cards - Requirement 5.7 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-discord-light border-discord-lighter">
          <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-discord-accent/20">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-discord-accent" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-discord-text">{stats.total}</p>
              <p className="text-xs sm:text-sm text-discord-muted">Toplam</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-discord-light border-discord-lighter">
          <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-yellow-500/20">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-discord-text">{stats.pending}</p>
              <p className="text-xs sm:text-sm text-discord-muted">Bekleyen</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-discord-light border-discord-lighter">
          <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-green-500/20">
              <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-discord-text">{stats.approved}</p>
              <p className="text-xs sm:text-sm text-discord-muted">Onaylı</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-discord-light border-discord-lighter">
          <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-red-500/20">
              <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-discord-text">{stats.rejected}</p>
              <p className="text-xs sm:text-sm text-discord-muted">Reddedilen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters - Requirement 5.2, 5.3 */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-discord-muted" />
              <Input
                placeholder="Kullanıcı adı veya e-posta ara..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full lg:w-[180px] justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {filters.status === 'all' ? 'Tüm Durumlar' : STATUS_LABELS[filters.status]}
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Durum Filtresi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}>
                  Tüm Durumlar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, status: 'pending' }))}>
                  Bekleyen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, status: 'approved' }))}>
                  Onaylı
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, status: 'rejected' }))}>
                  Reddedilen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Role Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full lg:w-[180px] justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {filters.role === 'all' ? 'Tüm Yetkiler' : (roleLabels[filters.role] || filters.role)}
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Yetki Filtresi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'all' }))}>
                  Tüm Yetkiler
                </DropdownMenuItem>
                {roles.map((role) => (
                  <DropdownMenuItem key={role.code} onClick={() => setFilters(prev => ({ ...prev, role: role.code }))}>
                    {role.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUserIds.size > 0 && (
        <Card className="bg-discord-accent/10 border-discord-accent">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-discord-text">
                <span className="font-bold">{selectedUserIds.size}</span> kullanıcı seçildi
                {pendingSelectedCount > 0 && (
                  <span className="text-discord-muted ml-2">
                    ({pendingSelectedCount} bekleyen)
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {pendingSelectedCount > 0 && (
                  <>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => openBulkDialog('approve')}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Toplu Onayla
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openBulkDialog('reject')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Toplu Reddet
                    </Button>
                  </>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedUserIds(new Set())}
                >
                  Seçimi Temizle
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table - Requirement 5.1 */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kullanıcı Listesi
          </CardTitle>
          <CardDescription>
            Toplam {pagination.total} kullanıcı bulundu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-discord-muted mb-4" />
              <p className="text-discord-text font-medium">Kullanıcı bulunamadı</p>
              <p className="text-discord-muted text-sm mt-1">
                Filtreleri değiştirerek tekrar deneyin
              </p>
            </div>
          ) : (
            <>
              {/* Mobil Kart Görünümü */}
              <div className="block lg:hidden space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`bg-discord-darker rounded-lg p-4 border transition-colors ${
                      selectedUserIds.has(user.id)
                        ? 'border-discord-accent'
                        : 'border-discord-lighter'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="h-4 w-4 rounded border-discord-light bg-discord-dark text-discord-accent focus:ring-discord-accent"
                        />
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-accent text-sm font-bold text-white">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-discord-text">{user.username}</p>
                          <p className="text-xs text-discord-muted">{user.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[user.status]}`}>
                        {STATUS_LABELS[user.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-discord-muted mb-3">
                      <span>Yetki: {user.role ? (roleLabels[user.role] || user.role) : 'Yok'}</span>
                      <span>Kayıt: {formatDate(user.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Detay Butonu - Requirement 5.6 */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/admin/users/${user.id}` as Parameters<typeof router.push>[0])}
                        className="flex-shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {user.status === 'pending' ? (
                        <>
                          <Button variant="success" size="sm" onClick={() => openApproveDialog(user)} className="flex-1">
                            <Check className="h-4 w-4 mr-1" />
                            Onayla
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => openRejectDialog(user)} className="flex-1">
                            <X className="h-4 w-4 mr-1" />
                            Reddet
                          </Button>
                        </>
                      ) : user.status === 'approved' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1">
                              <Shield className="h-4 w-4 mr-1" />
                              Yetki Değiştir
                              <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('mod'); setIsRoleChangeDialogOpen(true); }}>
                              Moderatör
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('admin'); setIsRoleChangeDialogOpen(true); }}>
                              Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('ust_yetkili'); setIsRoleChangeDialogOpen(true); }}>
                              Üst Yetkili
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-discord-muted text-sm flex-1">Reddedilmiş kullanıcı</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Masaüstü Tablo Görünümü */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-discord-lighter">
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.size === users.length && users.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-discord-light bg-discord-dark text-discord-accent focus:ring-discord-accent"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">Kullanıcı</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">E-posta</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">Durum</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">Yetki</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">Kayıt Tarihi</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-discord-muted">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-discord-lighter">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-discord-lighter/50 transition-colors ${
                          selectedUserIds.has(user.id) ? 'bg-discord-accent/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="h-4 w-4 rounded border-discord-light bg-discord-dark text-discord-accent focus:ring-discord-accent"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-discord-accent text-sm font-bold text-white">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-discord-text">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-discord-muted">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[user.status]}`}>
                            {STATUS_LABELS[user.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-discord-muted">{user.role ? (roleLabels[user.role] || user.role) : 'Yok'}</td>
                        <td className="px-4 py-3 text-discord-muted">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {/* Detay Butonu - Requirement 5.6 */}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/admin/users/${user.id}` as Parameters<typeof router.push>[0])}
                              title="Detay Görüntüle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user.status === 'pending' ? (
                              <>
                                <Button variant="success" size="sm" onClick={() => openApproveDialog(user)}>
                                  <Check className="h-4 w-4 mr-1" />
                                  Onayla
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => openRejectDialog(user)}>
                                  <X className="h-4 w-4 mr-1" />
                                  Reddet
                                </Button>
                              </>
                            ) : user.status === 'approved' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Shield className="h-4 w-4 mr-1" />
                                    Yetki Değiştir
                                    <ChevronDown className="h-4 w-4 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('mod'); setIsRoleChangeDialogOpen(true); }}>
                                    Moderatör
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('admin'); setIsRoleChangeDialogOpen(true); }}>
                                    Admin
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('ust_yetkili'); setIsRoleChangeDialogOpen(true); }}>
                                    Üst Yetkili
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-discord-lighter">
                  <p className="text-sm text-discord-muted">
                    Sayfa {pagination.page} / {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
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
            <label className="text-sm font-medium text-discord-text mb-2 block">Yetki Seviyesi</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {roleLabels[selectedRole] || selectedRole}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roles.filter(r => r.code !== 'owner').map((role) => (
                  <DropdownMenuItem key={role.code} onClick={() => setSelectedRole(role.code)}>
                    {role.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsApproveDialogOpen(false)} disabled={isProcessing}>İptal</Button>
            <Button variant="success" onClick={handleApprove} disabled={isProcessing}>
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
              <strong>{selectedUser?.username}</strong> kullanıcısının başvurusunu reddetmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRejectDialogOpen(false)} disabled={isProcessing}>İptal</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
              {isProcessing ? 'İşleniyor...' : 'Reddet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog - Requirement 5.4 */}
      <Dialog open={isRoleChangeDialogOpen} onOpenChange={setIsRoleChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yetki Değiştir</DialogTitle>
            <DialogDescription>
              <strong>{selectedUser?.username}</strong> kullanıcısının yetkisini değiştirmek üzeresiniz.
              Mevcut yetki: <strong>{selectedUser?.role ? (roleLabels[selectedUser.role] || selectedUser.role) : 'Yok'}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-discord-text mb-2 block">Yeni Yetki Seviyesi</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {roleLabels[selectedRole] || selectedRole}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roles.filter(r => r.code !== 'owner').map((role) => (
                  <DropdownMenuItem key={role.code} onClick={() => setSelectedRole(role.code)}>
                    {role.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRoleChangeDialogOpen(false)} disabled={isProcessing}>İptal</Button>
            <Button variant="default" onClick={handleRoleChange} disabled={isProcessing || selectedRole === selectedUser?.role}>
              {isProcessing ? 'İşleniyor...' : 'Değiştir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog - Requirement 5.5 */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'approve' ? 'Toplu Onaylama' : 'Toplu Reddetme'}
            </DialogTitle>
            <DialogDescription>
              <strong>{pendingSelectedCount}</strong> bekleyen kullanıcıyı {bulkAction === 'approve' ? 'onaylamak' : 'reddetmek'} üzeresiniz.
            </DialogDescription>
          </DialogHeader>
          {bulkAction === 'approve' && (
            <div className="py-4">
              <label className="text-sm font-medium text-discord-text mb-2 block">Atanacak Yetki Seviyesi</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {roleLabels[selectedRole] || selectedRole}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {roles.filter(r => r.code !== 'owner').map((role) => (
                    <DropdownMenuItem key={role.code} onClick={() => setSelectedRole(role.code)}>
                      {role.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsBulkDialogOpen(false)} disabled={isProcessing}>İptal</Button>
            <Button
              variant={bulkAction === 'approve' ? 'success' : 'destructive'}
              onClick={handleBulkAction}
              disabled={isProcessing}
            >
              {isProcessing ? 'İşleniyor...' : bulkAction === 'approve' ? 'Toplu Onayla' : 'Toplu Reddet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
