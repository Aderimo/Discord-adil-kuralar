'use client';

// Kullanıcı Detay Sayfası
// Requirement 5.6: Kullanıcı detay sayfası - tam geçmiş gösterimi

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
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
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Clock,
  Shield,
  Activity,
  LogIn,
  LogOut,
  Search,
  Eye,
  MessageSquare,
  UserCheck,
  UserX,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import type { UserRole, UserStatus, ActivityLog, ActivityAction } from '@/types';

interface UserDetail {
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
  user?: UserDetail;
  activityLogs?: ActivityLog[];
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
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ACTION_LABELS: Record<ActivityAction, string> = {
  login: 'Giriş Yaptı',
  logout: 'Çıkış Yaptı',
  view_content: 'İçerik Görüntüledi',
  search: 'Arama Yaptı',
  ai_query: 'AI Sorgusu',
  role_change: 'Yetki Değişikliği',
  user_approve: 'Kullanıcı Onayı',
  user_reject: 'Kullanıcı Reddi',
};

const ACTION_ICONS: Record<ActivityAction, React.ReactNode> = {
  login: <LogIn className="h-4 w-4" />,
  logout: <LogOut className="h-4 w-4" />,
  view_content: <Eye className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  ai_query: <MessageSquare className="h-4 w-4" />,
  role_change: <Shield className="h-4 w-4" />,
  user_approve: <UserCheck className="h-4 w-4" />,
  user_reject: <UserX className="h-4 w-4" />,
};

const ACTION_COLORS: Record<ActivityAction, string> = {
  login: 'bg-green-500/20 text-green-400',
  logout: 'bg-gray-500/20 text-gray-400',
  view_content: 'bg-blue-500/20 text-blue-400',
  search: 'bg-purple-500/20 text-purple-400',
  ai_query: 'bg-cyan-500/20 text-cyan-400',
  role_change: 'bg-orange-500/20 text-orange-400',
  user_approve: 'bg-green-500/20 text-green-400',
  user_reject: 'bg-red-500/20 text-red-400',
};

export default function UserDetailPage(): React.ReactElement {
  const { user: currentUser } = useAuth();
  const isOwnerRole = currentUser?.role === 'owner';
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'all' | '7d' | '30d' | 'today'>('all');
  const [isRoleChangeDialogOpen, setIsRoleChangeDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [isReApproveDialogOpen, setIsReApproveDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('reg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [emailRevealed, setEmailRevealed] = React.useState(false);


  // Kullanıcı detaylarını getir
  const fetchUserDetail = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      const now = new Date();
      if (timeFilter === '7d') {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        params.set('startDate', d.toISOString());
      } else if (timeFilter === '30d') {
        const d = new Date(now); d.setDate(d.getDate() - 30);
        params.set('startDate', d.toISOString());
      } else if (timeFilter === 'today') {
        const d = new Date(now); d.setHours(0, 0, 0, 0);
        params.set('startDate', d.toISOString());
      }
      const qs = params.toString();
      const response = await fetch(`/api/admin/users/${userId}${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      });
      const data: ApiResponse = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
        setActivityLogs(data.activityLogs || []);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Kullanıcı bilgileri yüklenemedi',
          variant: 'destructive',
        });
        // Kullanıcı bulunamazsa admin paneline yönlendir
        if (response.status === 404) {
          router.push('/admin');
        }
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
  }, [userId, toast, router, timeFilter]);

  useEffect(() => {
    if (userId) {
      fetchUserDetail();
    }
  }, [userId, fetchUserDetail]);

  // Yetki değiştirme
  const handleRoleChange = async (): Promise<void> => {
    if (!user) { return; }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Başarılı',
          description: `${user.username} kullanıcısının yetkisi ${ROLE_LABELS[selectedRole]} olarak değiştirildi`,
          variant: 'success',
        });
        fetchUserDetail();
        setIsRoleChangeDialogOpen(false);
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

  // Yetkiyi iptal et (modluktan atma)
  const handleRevoke = async (): Promise<void> => {
    if (!user) { return; }
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Başarılı', description: `${user.username} kullanıcısının yetkisi iptal edildi`, variant: 'success' });
        fetchUserDetail();
        setIsRevokeDialogOpen(false);
      } else {
        toast({ title: 'Hata', description: data.error || 'Yetki iptali başarısız', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Bağlantı Hatası', description: 'İşlem gerçekleştirilemedi', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Tekrar onayla (reddedilmiş kullanıcıyı yeniden onaylama)
  const handleReApprove = async (): Promise<void> => {
    if (!user) { return; }
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Başarılı', description: `${user.username} kullanıcısı ${ROLE_LABELS[selectedRole]} yetkisiyle yeniden onaylandı`, variant: 'success' });
        fetchUserDetail();
        setIsReApproveDialogOpen(false);
      } else {
        toast({ title: 'Hata', description: data.error || 'Onaylama başarısız', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Bağlantı Hatası', description: 'İşlem gerçekleştirilemedi', variant: 'destructive' });
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

  // Relative time formatla
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) { return 'Az önce'; }
    if (diffMins < 60) { return `${diffMins} dakika önce`; }
    if (diffHours < 24) { return `${diffHours} saat önce`; }
    if (diffDays < 7) { return `${diffDays} gün önce`; }
    return formatDate(dateString);
  };

  // Log detaylarını parse et
  const parseLogDetails = (details: Record<string, unknown>): string => {
    if (details.event === 'content_access' && details.contentTitle) {
      return `"${details.contentTitle}" içeriğini görüntüledi`;
    }
    if (details.event === 'search_query' && details.query) {
      return `"${details.query}" araması yaptı`;
    }
    if (details.event === 'ai_query' && details.query) {
      return `AI'a sordu: "${String(details.query).substring(0, 50)}..."`;
    }
    if (details.event === 'role_change') {
      return `${details.targetUsername || 'Kullanıcı'}: ${details.previousRole} → ${details.newRole}`;
    }
    if (details.event === 'user_approve') {
      return `${details.targetUsername || 'Kullanıcı'} onaylandı (${details.assignedRole})`;
    }
    if (details.event === 'user_reject') {
      return `${details.targetUsername || 'Kullanıcı'} reddedildi`;
    }
    if (details.event === 'user_login') {
      return 'Sisteme giriş yaptı';
    }
    if (details.event === 'user_logout') {
      return 'Sistemden çıkış yaptı';
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          <p className="text-discord-muted">Kullanıcı bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <User className="mx-auto h-16 w-16 text-discord-muted mb-4" />
          <h1 className="text-2xl font-bold text-discord-text mb-2">Kullanıcı Bulunamadı</h1>
          <p className="text-discord-muted mb-6">İstenen kullanıcı mevcut değil veya silinmiş olabilir.</p>
          <Button onClick={() => router.push('/admin')} variant="secondary">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Admin Paneline Dön
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin')}
            className="text-discord-muted hover:text-discord-text"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-discord-text">Kullanıcı Detayı</h1>
            <p className="text-discord-muted mt-1 text-sm">
              {user.username} kullanıcısının bilgileri ve aktivite geçmişi
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchUserDetail(true)}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* User Info Card */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-discord-accent text-2xl font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-3">
                  {user.username}
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[user.status]}`}>
                    {STATUS_LABELS[user.status]}
                  </span>
                </CardTitle>
                {isOwnerRole && user.email && (
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    <button
                      onClick={() => setEmailRevealed(v => !v)}
                      title={emailRevealed ? 'Gizle' : 'Emaili göster'}
                      className="hover:text-discord-text transition-colors"
                    >
                      <span className={emailRevealed ? '' : 'blur-sm select-none'}>
                        {user.email}
                      </span>
                    </button>
                  </CardDescription>
                )}
              </div>
            </div>
            {/* Revoke + Role Change Buttons - Only for approved users */}
            {user.status === 'approved' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsRevokeDialogOpen(true)}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Yetkiyi İptal Et
                </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Shield className="h-4 w-4 mr-2" />
                    Yetki Değiştir
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Yetki Seçin</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setSelectedRole('reg'); setIsRoleChangeDialogOpen(true); }} disabled={user.role === 'reg'}>Reg</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedRole('op'); setIsRoleChangeDialogOpen(true); }} disabled={user.role === 'op'}>Operatör</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedRole('gatekeeper'); setIsRoleChangeDialogOpen(true); }} disabled={user.role === 'gatekeeper'}>GateKeeper</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedRole('council'); setIsRoleChangeDialogOpen(true); }} disabled={user.role === 'council'}>Council</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedRole('gm'); setIsRoleChangeDialogOpen(true); }} disabled={user.role === 'gm'}>GM</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedRole('ust_yetkili'); setIsRoleChangeDialogOpen(true); }} disabled={user.role === 'ust_yetkili'}>Üst Yetkili</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedRole('owner'); setIsRoleChangeDialogOpen(true); }} disabled={user.role === 'owner'}>Owner</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            )}
            {/* Re-Approve Button - For rejected users */}
            {user.status === 'rejected' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsReApproveDialogOpen(true)}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Tekrar Onayla
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Role */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-discord-darker">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-accent/20">
                <Shield className="h-5 w-5 text-discord-accent" />
              </div>
              <div>
                <p className="text-xs text-discord-muted">Yetki Seviyesi</p>
                <p className="font-medium text-discord-text">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>

            {/* Created At */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-discord-darker">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <Calendar className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-discord-muted">Kayıt Tarihi</p>
                <p className="font-medium text-discord-text">{formatDate(user.createdAt)}</p>
              </div>
            </div>

            {/* Last Login */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-discord-darker">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-discord-muted">Son Giriş</p>
                <p className="font-medium text-discord-text">
                  {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Hiç giriş yapmadı'}
                </p>
              </div>
            </div>

            {/* Updated At */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-discord-darker">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20">
                <Activity className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-discord-muted">Son Güncelleme</p>
                <p className="font-medium text-discord-text">{formatRelativeTime(user.updatedAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aktivite Özeti İstatistikleri */}
      {activityLogs.length > 0 && (() => {
        const counts: Partial<Record<ActivityAction, number>> = {};
        activityLogs.forEach(l => { counts[l.action] = (counts[l.action] || 0) + 1; });
        const totalLogins = counts['login'] || 0;
        const totalSearches = counts['search'] || 0;
        const totalAI = counts['ai_query'] || 0;
        const totalViews = counts['view_content'] || 0;
        const uniqueIPs = [...new Set(activityLogs.map(l => l.ipAddress))];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-discord-light border-discord-lighter">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{totalLogins}</p>
                <p className="text-xs text-discord-muted mt-0.5">Toplam Giriş</p>
              </CardContent>
            </Card>
            <Card className="bg-discord-light border-discord-lighter">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{totalViews}</p>
                <p className="text-xs text-discord-muted mt-0.5">İçerik Görüntüleme</p>
              </CardContent>
            </Card>
            <Card className="bg-discord-light border-discord-lighter">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{totalAI}</p>
                <p className="text-xs text-discord-muted mt-0.5">AI Sorgusu</p>
              </CardContent>
            </Card>
            <Card className="bg-discord-light border-discord-lighter">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-purple-400">{uniqueIPs.length}</p>
                <p className="text-xs text-discord-muted mt-0.5">Farklı IP</p>
                {totalSearches > 0 && <p className="text-xs text-discord-muted/60">{totalSearches} arama</p>}
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Activity History */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Aktivite Geçmişi
              </CardTitle>
              <CardDescription>
                {activityLogs.length} aktivite kaydı gösteriliyor
              </CardDescription>
            </div>
            {/* Zaman Filtresi */}
            <div className="flex items-center gap-1 bg-discord-darker rounded-lg p-1">
              {([
                { key: 'all', label: 'Tümü' },
                { key: 'today', label: 'Bugün' },
                { key: '7d', label: '7 Gün' },
                { key: '30d', label: '30 Gün' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTimeFilter(key)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    timeFilter === key
                      ? 'bg-discord-accent text-white'
                      : 'text-discord-muted hover:text-discord-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-discord-muted mb-4" />
              <p className="text-discord-text font-medium">Aktivite bulunamadı</p>
              <p className="text-discord-muted text-sm mt-1">
                Bu kullanıcının henüz kayıtlı aktivitesi yok
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-discord-darker hover:bg-discord-dark transition-colors border border-discord-lighter hover:border-discord-light"
                >
                  {/* Action Icon */}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 ${ACTION_COLORS[log.action]}`}>
                    {ACTION_ICONS[log.action]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-discord-text">
                        {ACTION_LABELS[log.action]}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action]}`}>
                        {log.action}
                      </span>
                    </div>
                    {parseLogDetails(log.details) && (
                      <p className="text-xs text-discord-muted mt-1">
                        {parseLogDetails(log.details)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-discord-muted/70 font-mono">IP: {log.ipAddress}</span>
                      <span className="text-xs text-discord-muted/70">{formatDate(log.timestamp.toString())}</span>
                      <span className="text-xs text-discord-muted">{formatRelativeTime(log.timestamp.toString())}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Dialog */}
      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent className="bg-discord-dark border-discord-light">
          <DialogHeader>
            <DialogTitle className="text-discord-text">Yetkiyi İptal Et</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-discord-text">{user.username}</span> kullanıcısının
              yetkisini iptal etmek istediğinizden emin misiniz?
              Bu işlem kullanıcıyı anında sistemden atacak ve oturumunu sonlandıracaktır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRevokeDialogOpen(false)} disabled={isProcessing}>İptal</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={isProcessing}>
              {isProcessing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />İşleniyor...</> : 'Yetkiyi İptal Et'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-Approve Dialog */}
      <Dialog open={isReApproveDialogOpen} onOpenChange={setIsReApproveDialogOpen}>
        <DialogContent className="bg-discord-dark border-discord-light">
          <DialogHeader>
            <DialogTitle className="text-discord-text">Tekrar Onayla</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-discord-text">{user.username}</span> kullanıcısını
              hangi yetki seviyesiyle yeniden onaylamak istiyorsunuz?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-discord-text mb-2 block">Yetki Seviyesi</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {ROLE_LABELS[selectedRole] || selectedRole}
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
            <Button variant="secondary" onClick={() => setIsReApproveDialogOpen(false)} disabled={isProcessing}>İptal</Button>
            <Button variant="default" onClick={handleReApprove} disabled={isProcessing}>
              {isProcessing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />İşleniyor...</> : 'Onayla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={isRoleChangeDialogOpen} onOpenChange={setIsRoleChangeDialogOpen}>
        <DialogContent className="bg-discord-dark border-discord-light">
          <DialogHeader>
            <DialogTitle className="text-discord-text">Yetki Değiştir</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-discord-text">{user.username}</span> kullanıcısının
              yetkisini <span className="font-semibold text-discord-accent">{ROLE_LABELS[selectedRole]}</span> olarak
              değiştirmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-discord-lighter">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-discord-accent text-lg font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-discord-text">{user.username}</p>
                <p className="text-sm text-discord-muted">
                  {ROLE_LABELS[user.role]} → {ROLE_LABELS[selectedRole]}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsRoleChangeDialogOpen(false)}
              disabled={isProcessing}
            >
              İptal
            </Button>
            <Button
              variant="default"
              onClick={handleRoleChange}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  İşleniyor...
                </>
              ) : (
                'Yetkiyi Değiştir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
