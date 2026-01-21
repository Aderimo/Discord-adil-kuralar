'use client';

// Admin Logs Page - Aktivite logları görüntüleme
// Requirement 3.5: Tüm yetki değişikliklerini ve giriş işlemlerini loglamalı
// Requirement 9.1, 9.2, 9.3, 9.4: Loglama gereksinimleri

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  AlertTriangle,
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
  login: <LogIn className="h-4 w-4" />,
  logout: <LogOut className="h-4 w-4" />,
  view_content: <Eye className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  ai_query: <Bot className="h-4 w-4" />,
  role_change: <Shield className="h-4 w-4" />,
  user_approve: <UserCheck className="h-4 w-4" />,
  user_reject: <UserX className="h-4 w-4" />,
};

const ACTION_COLORS: Record<ActivityAction, string> = {
  login: 'text-discord-green',
  logout: 'text-discord-muted',
  view_content: 'text-discord-accent',
  search: 'text-discord-accent',
  ai_query: 'text-discord-yellow',
  role_change: 'text-discord-accent',
  user_approve: 'text-discord-green',
  user_reject: 'text-discord-red',
};

export default function LogsPage(): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const pageSize = 20;
  const { toast } = useToast();

  // Logları getir
  const fetchLogs = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (actionFilter !== 'all') {
        params.append('action', actionFilter);
      }

      const response = await fetch(`/api/admin/logs?${params}`, {
        credentials: 'include',
      });
      const data: LogsResponse = await response.json();

      if (data.success && data.logs) {
        setLogs(data.logs);
        setTotal(data.total || 0);
      } else {
        toast({
          title: 'Hata',
          description: data.error || 'Loglar yüklenemedi',
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
  }, [page, actionFilter, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Tarih formatla
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  // Detayları parse et
  const parseDetails = (details: string): Record<string, unknown> => {
    try {
      return JSON.parse(details);
    } catch {
      return { raw: details };
    }
  };

  // Detay özeti oluştur
  const getDetailsSummary = (action: ActivityAction, details: string): string => {
    const parsed = parseDetails(details);
    
    switch (action) {
      case 'user_approve':
        return `${parsed.targetUsername || 'Kullanıcı'} → ${parsed.assignedRole || 'rol'}`;
      case 'user_reject':
        return `${parsed.targetUsername || 'Kullanıcı'} reddedildi`;
      case 'role_change':
        return `${parsed.targetUsername || 'Kullanıcı'}: ${parsed.previousRole} → ${parsed.newRole}`;
      case 'login':
        return 'Başarılı giriş';
      case 'logout':
        return 'Oturum sonlandırıldı';
      case 'view_content':
        return parsed.contentId ? `İçerik: ${parsed.contentId}` : 'İçerik görüntülendi';
      case 'search':
        return parsed.query ? `Sorgu: "${parsed.query}"` : 'Arama yapıldı';
      case 'ai_query':
        return parsed.query ? `Soru: "${String(parsed.query).substring(0, 30)}..."` : 'AI sorgusu';
      default:
        return JSON.stringify(parsed).substring(0, 50);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          <p className="text-discord-muted">Loglar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-discord-text">Aktivite Logları</h1>
          <p className="text-discord-muted mt-1 text-sm sm:text-base">
            Sistem aktivitelerini ve kullanıcı işlemlerini görüntüleyin
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Action Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="text-xs sm:text-sm">
                <span className="truncate max-w-[100px] sm:max-w-none">
                  {actionFilter === 'all' ? 'Tüm İşlemler' : ACTION_LABELS[actionFilter as ActivityAction]}
                </span>
                <ChevronDown className="h-4 w-4 ml-1 sm:ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>İşlem Türü</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setActionFilter('all'); setPage(1); }}>
                Tüm İşlemler
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => { setActionFilter(key); setPage(1); }}
                >
                  <span className={`mr-2 ${ACTION_COLORS[key as ActivityAction]}`}>
                    {ACTION_ICONS[key as ActivityAction]}
                  </span>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <Card className="bg-discord-light border-discord-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Log Kayıtları
          </CardTitle>
          <CardDescription>
            Toplam {total} kayıt bulundu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-discord-muted mb-4" />
              <p className="text-discord-text font-medium">Log kaydı bulunamadı</p>
              <p className="text-discord-muted text-sm mt-1">
                Seçili filtreye uygun kayıt yok
              </p>
            </div>
          ) : (
            <>
              {/* Mobil Kart Görünümü */}
              <div className="block md:hidden space-y-3">
                {logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="bg-discord-darker rounded-lg p-4 border border-discord-lighter"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-accent text-xs font-bold text-white">
                          {log.user?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-discord-text text-sm">
                          {log.user?.username || 'Bilinmeyen'}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 ${ACTION_COLORS[log.action]}`}>
                        {ACTION_ICONS[log.action]}
                        <span className="text-xs font-medium">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </div>
                    </div>
                    <p className="text-discord-muted text-xs mb-2 line-clamp-2">
                      {getDetailsSummary(log.action, log.details)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-discord-muted">
                      <span className="font-mono">{log.ipAddress}</span>
                      <span>{formatDate(log.timestamp)}</span>
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
                        İşlem
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">
                        Detay
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">
                        IP Adresi
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-discord-muted">
                        Tarih
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-discord-lighter">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-discord-lighter/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-accent text-xs font-bold text-white">
                              {log.user?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <span className="font-medium text-discord-text">
                              {log.user?.username || 'Bilinmeyen'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-2 ${ACTION_COLORS[log.action]}`}>
                            {ACTION_ICONS[log.action]}
                            <span className="text-sm font-medium">
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-discord-muted text-sm max-w-xs truncate">
                          {getDetailsSummary(log.action, log.details)}
                        </td>
                        <td className="px-4 py-3 text-discord-muted text-sm font-mono">
                          {log.ipAddress}
                        </td>
                        <td className="px-4 py-3 text-discord-muted text-sm">
                          {formatDate(log.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-discord-lighter">
              <p className="text-sm text-discord-muted">
                Sayfa {page} / {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
