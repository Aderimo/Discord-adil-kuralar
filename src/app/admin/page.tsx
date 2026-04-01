'use client';

// Admin Panel - Gelişmiş Kullanıcı Yönetimi
// Requirement 5.1: Tüm kullanıcılar listesi (pending, approved, rejected)
// Requirement 5.4: Yetki değiştir dropdown
// Requirement 5.7: Kullanıcı sayısı istatistikleri

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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
  Activity,
  LogIn,
  Monitor,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import type { UserRole, UserStatus } from '@/types';

interface User {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  role: UserRole;
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

const ROLE_LABELS: Record<string, string> = {
  none: 'Yok',
  reg: 'Reg',
  op: 'Operatör',
  gatekeeper: 'GateKeeper',
  council: 'Council',
  gm: 'GM',
  ust_yetkili: 'Üst Yetkili',
  owner: 'Owner',
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
  const { user: currentUser } = useAuth();
  // Sadece owner email görebilir
  const isOwnerRole = currentUser?.role === 'owner';
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
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
  // Email gizleme: revealedEmails set'inde olan userId'lerin emaili görünür
  const [revealedEmails, setRevealedEmails] = React.useState<Set<string>>(new Set());
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

  // Kullanıcıları getir
  const fetchUsers = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) { params.set('search', filters.search); }
      if (filters.status !== 'all') { params.set('status', filters.status); }
      if (filters.role !== 'all') { params.set('role', filters.role); }
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
    fetchUsers();
  }, [fetchUsers]);

  // Arama debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Kullanıcı onaylama
  const handleApprove = async (): Promise<void> => {
    if (!selectedUser) { return; }

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
          description: `${selectedUser.username} kullanıcısı ${ROLE_LABELS[selectedRole]} olarak onaylandı`,
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
    if (!selectedUser) { return; }

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
    if (!selectedUser) { return; }

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
          description: `${selectedUser.username} kullanıcısının yetkisi ${ROLE_LABELS[selectedRole]} olarak değiştirildi`,
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
    if (selectedUserIds.size === 0) { return; }

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
    setSelectedRole('reg');
    setIsApproveDialogOpen(true);
  };

  const openRejectDialog = (user: User): void => {
    setSelectedUser(user);
    setIsRejectDialogOpen(true);
  };

  const openBulkDialog = (action: 'approve' | 'reject'): void => {
    setBulkAction(action);
    setSelectedRole('reg');
    setIsBulkDialogOpen(true);
  };

  // Aktivite verileri (son 24 saat logins + IP konum)
  interface ActivityEntry {
    username: string;
    ipAddress: string;
    timestamp: string;
    action: string;
    country?: string;
    city?: string;
  }
  const [recentActivity, setRecentActivity] = React.useState<ActivityEntry[]>([]);
  const [hourlyLogins, setHourlyLogins] = React.useState<number[]>(Array(24).fill(0));
  const [isActivityLoading, setIsActivityLoading] = React.useState(false);
  const ipLocationCache = React.useRef<Map<string, { country: string; city: string }>>(new Map());

  const fetchActivity = React.useCallback(async () => {
    setIsActivityLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '50', action: 'login' });
      const res = await fetch(`/api/admin/logs?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.success || !data.logs) return;

      // Saatlik login dağılımı
      const hourCounts = Array(24).fill(0);
      const now = new Date();
      const last24h: ActivityEntry[] = [];

      for (const log of data.logs) {
        const d = new Date(log.timestamp);
        hourCounts[d.getHours()]++;
        if (now.getTime() - d.getTime() < 86400000) {
          last24h.push({
            username: log.user?.username || '?',
            ipAddress: log.ipAddress,
            timestamp: log.timestamp,
            action: log.action,
          });
        }
      }
      setHourlyLogins(hourCounts);

      // IP konum sorgusu (ip-api.com ücretsiz)
      const uniqueIPs = [...new Set(last24h.map(a => a.ipAddress))].filter(ip => ip && ip !== '::1' && !ip.startsWith('127.') && !ip.startsWith('192.168.'));
      for (const ip of uniqueIPs.slice(0, 10)) {
        if (ipLocationCache.current.has(ip)) continue;
        try {
          const locRes = await fetch(`/api/admin/ip-location?ip=${encodeURIComponent(ip)}`);
          const loc = await locRes.json();
          if (loc.status === 'success') {
            ipLocationCache.current.set(ip, { country: loc.country || '', city: loc.city || '' });
          }
        } catch { /* ignore */ }
      }

      // Konum bilgisini ekle
      setRecentActivity(last24h.slice(0, 15).map(a => ({
        ...a,
        ...ipLocationCache.current.get(a.ipAddress),
      })));
    } catch { /* ignore */ } finally {
      setIsActivityLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Email göster/gizle toggle (sadece owner)
  const toggleEmailReveal = (userId: string): void => {
    if (!isOwnerRole) return;
    setRevealedEmails(prev => {
      const next = new Set(prev);
      if (next.has(userId)) { next.delete(userId); } else { next.add(userId); }
      return next;
    });
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

      {/* ── Site Aktivitesi Bölümü ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Saatlik Login Grafiği */}
        <Card className="bg-discord-light border-discord-lighter">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-discord-accent" />
              Saatlik Login Aktivitesi
            </CardTitle>
            <CardDescription>Son loglardan hesaplanmış (son 50 login)</CardDescription>
          </CardHeader>
          <CardContent>
            {isActivityLoading ? (
              <div className="flex items-center justify-center h-24">
                <RefreshCw className="h-5 w-5 animate-spin text-discord-muted" />
              </div>
            ) : (
              <div className="flex items-end gap-0.5 h-24 mt-2">
                {hourlyLogins.map((count, hour) => {
                  const max = Math.max(...hourlyLogins, 1);
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div
                        className="w-full rounded-t bg-discord-accent/60 hover:bg-discord-accent transition-all"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                      <span className="text-[8px] text-discord-muted">{hour}</span>
                      {count > 0 && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-discord-darker text-discord-text text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          {hour}:00 — {count} login
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Son 24 Saat Aktif Kullanıcılar */}
        <Card className="bg-discord-light border-discord-lighter">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-400" />
                Son 24 Saat Aktif Kullanıcılar
              </span>
              <button onClick={fetchActivity} disabled={isActivityLoading} className="text-discord-muted hover:text-discord-text">
                <RefreshCw className={`h-3.5 w-3.5 ${isActivityLoading ? 'animate-spin' : ''}`} />
              </button>
            </CardTitle>
            <CardDescription>{recentActivity.length} giriş kaydı</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-discord-muted text-sm text-center py-6">Son 24 saatte giriş yok</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-discord-lighter last:border-0">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
                      <LogIn className="h-3 w-3 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-discord-text truncate">{a.username}</p>
                      <div className="flex items-center gap-2 text-discord-muted mt-0.5 flex-wrap">
                        <span className="flex items-center gap-0.5">
                          <Monitor className="h-2.5 w-2.5" />
                          <span className="font-mono">{a.ipAddress}</span>
                        </span>
                        {(a.country || a.city) && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {[a.city, a.country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-discord-muted flex-shrink-0">
                      {new Date(a.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                placeholder={isOwnerRole ? 'Kullanıcı adı veya e-posta ara...' : 'Kullanıcı adı ara...'}
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
                    {filters.role === 'all' ? 'Tüm Yetkiler' : ROLE_LABELS[filters.role]}
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
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'reg' }))}>Reg</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'op' }))}>Operatör</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'gatekeeper' }))}>GateKeeper</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'council' }))}>Council</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'gm' }))}>GM</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'ust_yetkili' }))}>Üst Yetkili</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, role: 'owner' }))}>Owner</DropdownMenuItem>
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
                          {isOwnerRole && user.email && (
                            <button
                              onClick={() => toggleEmailReveal(user.id)}
                              title={revealedEmails.has(user.id) ? 'Gizle' : 'Emaili göster'}
                              className="text-xs text-discord-muted hover:text-discord-text transition-colors text-left"
                            >
                              <span className={revealedEmails.has(user.id) ? '' : 'blur-sm select-none'}>
                                {user.email}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[user.status]}`}>
                        {STATUS_LABELS[user.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-discord-muted mb-3">
                      <span>Yetki: {ROLE_LABELS[user.role]}</span>
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
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('reg'); setIsRoleChangeDialogOpen(true); }}>Reg</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('op'); setIsRoleChangeDialogOpen(true); }}>Operatör</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('gatekeeper'); setIsRoleChangeDialogOpen(true); }}>GateKeeper</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('council'); setIsRoleChangeDialogOpen(true); }}>Council</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('gm'); setIsRoleChangeDialogOpen(true); }}>GM</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('ust_yetkili'); setIsRoleChangeDialogOpen(true); }}>Üst Yetkili</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('owner'); setIsRoleChangeDialogOpen(true); }}>Owner</DropdownMenuItem>
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
                      {isOwnerRole && <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">E-posta</th>}
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
                        {isOwnerRole && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleEmailReveal(user.id)}
                              title={revealedEmails.has(user.id) ? 'Gizle' : 'Emaili göster'}
                              className="text-xs text-discord-muted hover:text-discord-text transition-colors text-left"
                            >
                              <span className={revealedEmails.has(user.id) ? '' : 'blur-sm select-none'}>
                                {user.email || '—'}
                              </span>
                            </button>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[user.status]}`}>
                            {STATUS_LABELS[user.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-discord-muted">{ROLE_LABELS[user.role]}</td>
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
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('reg'); setIsRoleChangeDialogOpen(true); }}>Reg</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('op'); setIsRoleChangeDialogOpen(true); }}>Operatör</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('gatekeeper'); setIsRoleChangeDialogOpen(true); }}>GateKeeper</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('council'); setIsRoleChangeDialogOpen(true); }}>Council</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('gm'); setIsRoleChangeDialogOpen(true); }}>GM</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('ust_yetkili'); setIsRoleChangeDialogOpen(true); }}>Üst Yetkili</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedRole('owner'); setIsRoleChangeDialogOpen(true); }}>Owner</DropdownMenuItem>
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
                  {ROLE_LABELS[selectedRole]}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedRole('reg')}>Reg</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('op')}>Operatör</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('gatekeeper')}>GateKeeper</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('council')}>Council</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('gm')}>GM</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('ust_yetkili')}>Üst Yetkili</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('owner')}>Owner</DropdownMenuItem>
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
              Mevcut yetki: <strong>{selectedUser ? ROLE_LABELS[selectedUser.role] : ''}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-discord-text mb-2 block">Yeni Yetki Seviyesi</label>
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
                <DropdownMenuItem onClick={() => setSelectedRole('reg')}>Reg</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('op')}>Operatör</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('gatekeeper')}>GateKeeper</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('council')}>Council</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('gm')}>GM</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('ust_yetkili')}>Üst Yetkili</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedRole('owner')}>Owner</DropdownMenuItem>
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
                    {ROLE_LABELS[selectedRole]}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedRole('reg')}>Reg</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRole('op')}>Operatör</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRole('gatekeeper')}>GateKeeper</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRole('council')}>Council</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRole('gm')}>GM</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRole('ust_yetkili')}>Üst Yetkili</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRole('owner')}>Owner</DropdownMenuItem>
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
