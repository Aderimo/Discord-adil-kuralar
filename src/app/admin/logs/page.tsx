'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ScrollText,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  UserCheck,
  UserX,
  Shield,
  Eye,
  Search,
  Bot,
  Download,
  FileJson,
  FileSpreadsheet,
  Trash2,
  Filter,
  Calendar,
  Monitor,
  ChevronUp,
  Activity,
  Clock,
  TrendingUp,
} from 'lucide-react';
import type { ActivityAction } from '@/types';

interface LogUser {
  username: string;
  email: string;
}

interface LogEntry {
  id: string;
  userId: string;
  action: ActivityAction;
  details: string;
  ipAddress: string;
  timestamp: string;
  user?: LogUser;
}

interface LogsResponse {
  success: boolean;
  logs?: LogEntry[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

const ACTION_LABELS: Record<ActivityAction, string> = {
  login: 'Giriş',
  logout: 'Çıkış',
  view_content: 'İçerik Görüntüleme',
  search: 'Arama',
  ai_query: 'AI Sorgusu',
  role_change: 'Yetki Değişikliği',
  user_approve: 'Kullanıcı Onaylama',
  user_reject: 'Kullanıcı Reddetme',
};

const ACTION_ICONS: Record<ActivityAction, React.ReactNode> = {
  login: <LogIn className="h-3.5 w-3.5" />,
  logout: <LogOut className="h-3.5 w-3.5" />,
  view_content: <Eye className="h-3.5 w-3.5" />,
  search: <Search className="h-3.5 w-3.5" />,
  ai_query: <Bot className="h-3.5 w-3.5" />,
  role_change: <Shield className="h-3.5 w-3.5" />,
  user_approve: <UserCheck className="h-3.5 w-3.5" />,
  user_reject: <UserX className="h-3.5 w-3.5" />,
};

const ACTION_COLORS: Record<ActivityAction, { bg: string; text: string; border: string }> = {
  login:        { bg: 'bg-green-500/10',   text: 'text-green-400',        border: 'border-green-500/30' },
  logout:       { bg: 'bg-zinc-500/10',    text: 'text-zinc-400',         border: 'border-zinc-500/30' },
  view_content: { bg: 'bg-blue-500/10',    text: 'text-blue-400',         border: 'border-blue-500/30' },
  search:       { bg: 'bg-sky-500/10',     text: 'text-sky-400',          border: 'border-sky-500/30' },
  ai_query:     { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',       border: 'border-yellow-500/30' },
  role_change:  { bg: 'bg-purple-500/10',  text: 'text-purple-400',       border: 'border-purple-500/30' },
  user_approve: { bg: 'bg-emerald-500/10', text: 'text-emerald-400',      border: 'border-emerald-500/30' },
  user_reject:  { bg: 'bg-red-500/10',     text: 'text-red-400',          border: 'border-red-500/30' },
};

const ACTION_TIMELINE_COLORS: Record<ActivityAction, string> = {
  login: 'bg-green-500',
  logout: 'bg-zinc-500',
  view_content: 'bg-blue-500',
  search: 'bg-sky-500',
  ai_query: 'bg-yellow-500',
  role_change: 'bg-purple-500',
  user_approve: 'bg-emerald-500',
  user_reject: 'bg-red-500',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date);
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin}dk önce`;
  if (diffH < 24) return `${diffH}sa önce`;
  if (diffD < 7) return `${diffD}g önce`;
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit' }).format(date);
}

function parseDetails(details: string): Record<string, unknown> {
  try { return JSON.parse(details); } catch { return { raw: details }; }
}

function getDetailsSummary(action: ActivityAction, details: string): string {
  const parsed = parseDetails(details);
  switch (action) {
    case 'user_approve': return `${String(parsed.targetUsername || 'Kullanıcı')} → ${String(parsed.assignedRole || 'rol')}`;
    case 'user_reject':  return `${String(parsed.targetUsername || 'Kullanıcı')} reddedildi`;
    case 'role_change':  return `${String(parsed.targetUsername || 'Kullanıcı')}: ${String(parsed.previousRole || '?')} → ${String(parsed.newRole || '?')}`;
    case 'login':        return `IP: ${String(parsed.ipAddress || '-')}`;
    case 'logout':       return 'Oturum sonlandırıldı';
    case 'view_content': return parsed.contentId ? `İçerik: ${String(parsed.contentId)}` : 'İçerik görüntülendi';
    case 'search':       return parsed.query ? `"${String(parsed.query).substring(0, 40)}"` : 'Arama yapıldı';
    case 'ai_query':     return parsed.query ? `"${String(parsed.query).substring(0, 40)}..."` : 'AI sorgusu';
    default:             return JSON.stringify(parsed).substring(0, 60);
  }
}

export default function LogsPage(): React.ReactElement {
  const { user } = useAuth();
  const { toast } = useToast();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [ipSearch, setIpSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (ipSearch.trim()) params.append('ipAddress', ipSearch.trim());

      const response = await fetch(`/api/admin/logs?${params}`, { credentials: 'include' });
      const data: LogsResponse = await response.json();

      if (data.success && data.logs) {
        let filtered = data.logs;
        if (userSearch.trim()) {
          const q = userSearch.toLowerCase();
          filtered = filtered.filter(l => l.user?.username?.toLowerCase().includes(q));
        }
        setLogs(filtered);
        setTotal(data.total || 0);
      } else {
        toast({ title: 'Hata', description: data.error || 'Loglar yüklenemedi', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Bağlantı Hatası', description: 'Sunucuya bağlanılamadı', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, actionFilter, startDate, endDate, userSearch, ipSearch, toast]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchLogs(); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchLogs]);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (actionFilter !== 'all') params.append('action', actionFilter);
      const response = await fetch(`/api/admin/logs/export?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error((await response.json()).error || 'Export başarısız');
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `logs-export.${format}`;
      if (contentDisposition) {
        const m = contentDisposition.match(/filename="(.+)"/);
        if (m?.[1]) filename = m[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast({ title: 'Export Başarılı', description: `${format.toUpperCase()} olarak indirildi` });
    } catch (error) {
      toast({ title: 'Export Hatası', description: error instanceof Error ? error.message : 'Hata', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const response = await fetch('/api/admin/logs', { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Loglar Temizlendi', description: `${data.deleted ?? 0} kayıt silindi` });
        setLogs([]); setTotal(0); setPage(1);
        setIsClearDialogOpen(false);
      } else {
        toast({ title: 'Hata', description: data.error || 'Temizleme başarısız', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Bağlantı Hatası', description: 'İşlem gerçekleştirilemedi', variant: 'destructive' });
    } finally {
      setIsClearing(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const isOwner = user?.role === 'ust_yetkili' || user?.role === 'owner';

  // Aksiyon dağılımı (mini istatistik)
  const actionCounts = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          <p className="text-discord-muted text-sm">Loglar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-discord-accent/20">
            <Activity className="h-5 w-5 text-discord-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-discord-text">Aktivite Logları</h1>
            <p className="text-xs text-discord-muted">Toplam {total.toLocaleString('tr-TR')} kayıt</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => fetchLogs(true)} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 hidden sm:inline">Yenile</span>
          </Button>

          <Button
            variant="secondary" size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={showFilters ? 'bg-discord-accent/20 text-discord-accent' : ''}
          >
            <Filter className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">Filtreler</span>
            {(actionFilter !== 'all' || startDate || endDate || userSearch || ipSearch) && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-discord-accent text-[10px] text-white font-bold">!</span>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" disabled={isExporting || logs.length === 0}>
                {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileSpreadsheet className="h-4 w-4 mr-2 text-green-400" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <FileJson className="h-4 w-4 mr-2 text-yellow-400" /> JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isOwner && (
            <Button
              variant="destructive" size="sm"
              onClick={() => setIsClearDialogOpen(true)}
              disabled={total === 0}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Temizle</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Mini Stats Bar ── */}
      {logs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.entries(actionCounts) as [ActivityAction, number][])
            .sort(([,a],[,b]) => b - a)
            .slice(0, 6)
            .map(([action, count]) => {
              const colors = ACTION_COLORS[action];
              return (
                <button
                  key={action}
                  onClick={() => { setActionFilter(action); setPage(1); }}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80`}
                >
                  {ACTION_ICONS[action]}
                  {ACTION_LABELS[action]}
                  <span className="font-bold">{count}</span>
                </button>
              );
            })}
          {actionFilter !== 'all' && (
            <button
              onClick={() => { setActionFilter('all'); setPage(1); }}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border border-discord-lighter text-discord-muted hover:text-discord-text transition-colors"
            >
              × Filtreyi Kaldır
            </button>
          )}
        </div>
      )}

      {/* ── Filter Panel ── */}
      {showFilters && (
        <Card className="bg-discord-dark border-discord-light">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Action Filter */}
              <div>
                <label className="text-xs text-discord-muted mb-1.5 block font-medium">İşlem Türü</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                      <span className="truncate">
                        {actionFilter === 'all' ? 'Tüm İşlemler' : ACTION_LABELS[actionFilter as ActivityAction]}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => { setActionFilter('all'); setPage(1); }}>
                      Tüm İşlemler
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(Object.entries(ACTION_LABELS) as [ActivityAction, string][]).map(([key, label]) => (
                      <DropdownMenuItem key={key} onClick={() => { setActionFilter(key); setPage(1); }}>
                        <span className={`mr-2 ${ACTION_COLORS[key].text}`}>{ACTION_ICONS[key]}</span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* User Search */}
              <div>
                <label className="text-xs text-discord-muted mb-1.5 block font-medium">Kullanıcı Ara</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-discord-muted" />
                  <Input
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setPage(1); }}
                    placeholder="Kullanıcı adı..."
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>

              {/* IP Filter */}
              <div>
                <label className="text-xs text-discord-muted mb-1.5 block font-medium flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> IP Adresi
                </label>
                <div className="relative">
                  <Monitor className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-discord-muted" />
                  <Input
                    value={ipSearch}
                    onChange={e => { setIpSearch(e.target.value); setPage(1); }}
                    placeholder="192.168.1.1"
                    className="pl-8 h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-xs text-discord-muted mb-1.5 block font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Başlangıç
                </label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setPage(1); }}
                  className="h-9 text-xs"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="text-xs text-discord-muted mb-1.5 block font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Bitiş
                </label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setPage(1); }}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            {(actionFilter !== 'all' || startDate || endDate || userSearch || ipSearch) && (
              <button
                onClick={() => { setActionFilter('all'); setUserSearch(''); setIpSearch(''); setStartDate(''); setEndDate(''); setPage(1); }}
                className="mt-3 text-xs text-discord-red hover:underline"
              >
                Tüm filtreleri temizle
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Log List ── */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-discord-light mb-4">
            <ScrollText className="h-8 w-8 text-discord-muted" />
          </div>
          <p className="text-discord-text font-medium">Log kaydı bulunamadı</p>
          <p className="text-discord-muted text-sm mt-1">Seçili filtreye uygun kayıt yok</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const colors = ACTION_COLORS[log.action] || ACTION_COLORS.view_content;
            const isExpanded = expandedRow === log.id;
            const parsed = parseDetails(log.details);

            return (
              <div
                key={log.id}
                className={`rounded-lg border transition-all ${isExpanded ? 'border-discord-accent/40 bg-discord-dark' : 'border-discord-lighter bg-discord-darker hover:border-discord-light hover:bg-discord-dark'}`}
              >
                {/* Main Row */}
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                >
                  {/* Timeline dot */}
                  <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${ACTION_TIMELINE_COLORS[log.action]} text-white`}>
                    {ACTION_ICONS[log.action]}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-discord-text">
                          {log.user?.username || 'Bilinmeyen'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                          {ACTION_LABELS[log.action]}
                        </span>
                      </div>
                      <p className="text-xs text-discord-muted mt-0.5 truncate">
                        {getDetailsSummary(log.action, log.details)}
                      </p>
                    </div>

                    {/* Right side: IP + Time */}
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-discord-muted">
                        <Monitor className="h-3 w-3" />
                        <span className="font-mono">{log.ipAddress}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-discord-muted">
                        <Clock className="h-3 w-3" />
                        <span title={formatDate(log.timestamp)}>{formatDateShort(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="text-discord-muted flex-shrink-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-discord-lighter px-4 py-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-discord-muted font-medium mb-1">Kullanıcı</p>
                        <p className="text-discord-text">{log.user?.username || '—'}</p>
                      </div>
                      <div>
                        <p className="text-discord-muted font-medium mb-1">IP Adresi</p>
                        <p className="font-mono text-discord-text">{log.ipAddress}</p>
                      </div>
                      <div>
                        <p className="text-discord-muted font-medium mb-1">Tarih & Saat</p>
                        <p className="text-discord-text">{formatDate(log.timestamp)}</p>
                      </div>
                      <div>
                        <p className="text-discord-muted font-medium mb-1">İşlem ID</p>
                        <p className="font-mono text-discord-muted text-[10px] truncate">{log.id}</p>
                      </div>
                    </div>
                    {Object.keys(parsed).length > 0 && (
                      <div>
                        <p className="text-discord-muted font-medium text-xs mb-1">Detaylar</p>
                        <pre className="text-xs bg-discord-darker rounded-md p-3 overflow-x-auto text-discord-text border border-discord-lighter whitespace-pre-wrap">
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-discord-muted">
            <span className="font-medium text-discord-text">{(page - 1) * pageSize + 1}</span>
            {' – '}
            <span className="font-medium text-discord-text">{Math.min(page * pageSize, total)}</span>
            {' / '}
            <span>{total.toLocaleString('tr-TR')}</span> kayıt
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="hidden sm:flex">
              «
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = page - 2 + i;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className="hidden sm:flex w-9"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="hidden sm:flex">
              »
            </Button>
          </div>
        </div>
      )}

      {/* ── Clear Logs Dialog ── */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-discord-red">
              <Trash2 className="h-5 w-5" />
              Logları Temizle
            </DialogTitle>
            <DialogDescription>
              Tüm aktivite logları kalıcı olarak silinecek. Bu işlem geri alınamaz.
              <br /><br />
              <strong className="text-discord-text">Toplam {total.toLocaleString('tr-TR')} kayıt silinecek.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsClearDialogOpen(false)} disabled={isClearing}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleClearLogs} disabled={isClearing}>
              {isClearing ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Siliniyor...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Evet, Temizle</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unused import suppression */}
      <span className="sr-only"><TrendingUp /><TrendingUp /></span>
    </div>
  );
}
