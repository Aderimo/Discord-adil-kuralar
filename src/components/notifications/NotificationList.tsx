'use client';

/**
 * NotificationList Bileşeni
 * Bildirim listesi dropdown içeriği
 *
 * Requirement 9.4: WHEN a user clicks on a notification THEN THE System SHALL navigate to the relevant page
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    UserPlus,
    FileEdit,
    Shield,
    Bell,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Notification, NotificationType } from '@/types';

interface NotificationListProps {
    notifications: Notification[];
    isLoading?: boolean;
    onMarkAsRead: (id: string) => void;
    onClose: () => void;
}

// Bildirim tipi için ikon ve renk
const notificationConfig: Record<
    NotificationType,
    { icon: React.ReactNode; color: string }
> = {
    new_registration: {
        icon: <UserPlus className="h-4 w-4" />,
        color: 'text-green-400',
    },
    content_change: {
        icon: <FileEdit className="h-4 w-4" />,
        color: 'text-blue-400',
    },
    role_change: {
        icon: <Shield className="h-4 w-4" />,
        color: 'text-yellow-400',
    },
    system: {
        icon: <Bell className="h-4 w-4" />,
        color: 'text-discord-accent',
    },
};

export function NotificationList({
    notifications,
    isLoading,
    onMarkAsRead,
    onClose,
}: NotificationListProps) {
    const router = useRouter();

    // Bildirime tıklandığında
    const handleClick = (notification: Notification) => {
        // Okunmamışsa okundu yap
        if (!notification.read) {
            onMarkAsRead(notification.id);
        }

        // Link varsa yönlendir
        const data = notification.data as { link?: string };
        if (data.link) {
            router.push(data.link);
            onClose();
        }
    };

    // Yükleniyor durumu
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-discord-accent" />
            </div>
        );
    }

    // Boş durum
    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-discord-muted">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Bildirim yok</p>
            </div>
        );
    }

    return (
        <ScrollArea className="max-h-80">
            <div className="divide-y divide-discord-light">
                {notifications.map((notification) => {
                    const config = notificationConfig[notification.type] || notificationConfig.system;

                    return (
                        <div
                            key={notification.id}
                            className={`
                flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors
                ${notification.read
                                    ? 'bg-transparent hover:bg-discord-light/50'
                                    : 'bg-discord-accent/10 hover:bg-discord-accent/20'
                                }
              `}
                            onClick={() => handleClick(notification)}
                        >
                            {/* İkon */}
                            <div
                                className={`flex-shrink-0 mt-0.5 ${config.color}`}
                            >
                                {config.icon}
                            </div>

                            {/* İçerik */}
                            <div className="flex-1 min-w-0">
                                <p
                                    className={`text-sm ${notification.read
                                            ? 'text-discord-muted'
                                            : 'text-discord-text font-medium'
                                        }`}
                                >
                                    {notification.title}
                                </p>
                                <p className="text-xs text-discord-muted mt-0.5 line-clamp-2">
                                    {notification.message}
                                </p>
                                <p className="text-xs text-discord-muted/70 mt-1">
                                    {formatDistanceToNow(new Date(notification.createdAt), {
                                        addSuffix: true,
                                        locale: tr,
                                    })}
                                </p>
                            </div>

                            {/* Okundu işareti butonu */}
                            {!notification.read && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="flex-shrink-0 h-6 w-6 rounded-full hover:bg-discord-light"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkAsRead(notification.id);
                                    }}
                                    title="Okundu olarak işaretle"
                                >
                                    <Check className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}

export default NotificationList;
