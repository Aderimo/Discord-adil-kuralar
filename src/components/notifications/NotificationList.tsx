'use client';

/**
 * NotificationList Bileşeni
 * Dropdown bildirim listesi - okunmamış/okunmuş bildirimler
 *
 * Requirements:
 * - 9.4: THE System SHALL display a dropdown notification list
 * - 9.5: Kullanıcı bildirime tıkladığında okundu olarak işaretle
 */

import React, { useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Users, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Notification, NotificationType } from '@/lib/notifications';

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

const typeConfig: Record<NotificationType, { icon: React.ReactNode; color: string }> = {
  new_user: {
    icon: <Users className="h-4 w-4" />,
    color: 'text-discord-accent',
  },
  content_change: {
    icon: <FileEdit className="h-4 w-4" />,
    color: 'text-discord-green',
  },
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) { return 'Az önce'; }
  if (diffMin < 60) { return `${diffMin}dk önce`; }
  if (diffHour < 24) { return `${diffHour}s önce`; }
  return `${diffDay}g önce`;
}

export function NotificationList({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationListProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-discord-light bg-discord-dark shadow-xl z-50"
    >
      {/* Başlık */}
      <div className="flex items-center justify-between border-b border-discord-light px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-discord-accent" />
          <span className="font-semibold text-discord-text">Bildirimler</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-discord-accent/20 px-2 py-0.5 text-xs font-medium text-discord-accent">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="h-7 gap-1 px-2 text-xs text-discord-muted hover:text-discord-text"
          >
            <CheckCheck className="h-3 w-3" />
            Tümü okundu
          </Button>
        )}
      </div>

      {/* Bildirim listesi */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-discord-accent border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bell className="mb-2 h-8 w-8 text-discord-muted" />
            <p className="text-sm text-discord-muted">Henüz bildirim yok</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const config = typeConfig[notification.type] ?? typeConfig.new_user;
            return (
              <div
                key={notification.id}
                className={`flex items-start gap-3 border-b border-discord-light/50 px-4 py-3 transition-colors last:border-0 ${
                  !notification.isRead
                    ? 'bg-discord-accent/5 hover:bg-discord-accent/10'
                    : 'hover:bg-discord-light/30'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${config.color}`}>
                  {config.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm font-medium ${
                        !notification.isRead ? 'text-discord-text' : 'text-discord-muted'
                      }`}
                    >
                      {notification.title}
                    </p>
                    {!notification.isRead && (
                      <button
                        onClick={() => onMarkAsRead(notification.id)}
                        className="flex-shrink-0 text-discord-muted hover:text-discord-accent"
                        title="Okundu olarak işaretle"
                        aria-label="Okundu olarak işaretle"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-discord-muted line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-discord-muted/60">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-discord-accent" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default NotificationList;
