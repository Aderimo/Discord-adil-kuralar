'use client';

/**
 * NotificationBell Bileşeni
 * Header'da bildirim ikonu ve badge
 *
 * Requirement 9.3: THE System SHALL display notification count badge in the header
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationList } from './NotificationList';
import type { Notification } from '@/types';

interface NotificationBellProps {
    className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Bildirimleri yükle
    const loadNotifications = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/notifications?limit=10');
            const data = await response.json();

            if (data.success) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (error) {
            console.error('Bildirimler yüklenemedi:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // İlk yükleme
    useEffect(() => {
        loadNotifications();

        // 60 saniyede bir yenile
        const interval = setInterval(loadNotifications, 60000);
        return () => clearInterval(interval);
    }, [loadNotifications]);

    // Bildirim okundu olarak işaretle
    const handleMarkAsRead = async (id: string) => {
        try {
            const response = await fetch(`/api/notifications/${id}`, {
                method: 'PUT',
            });

            if (response.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, read: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Bildirim güncellenemedi:', error);
        }
    };

    // Tümünü okundu yap
    const handleMarkAllAsRead = async () => {
        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'POST',
            });

            if (response.ok) {
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Bildirimler güncellenemedi:', error);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`relative ${className}`}
                    aria-label={`Bildirimler (${unreadCount} okunmamış)`}
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0 bg-discord-dark border-discord-light"
                align="end"
            >
                <div className="flex items-center justify-between border-b border-discord-light px-4 py-3">
                    <h3 className="font-semibold text-discord-text">Bildirimler</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-discord-accent hover:text-discord-accent/80"
                        >
                            Tümünü okundu yap
                        </Button>
                    )}
                </div>
                <NotificationList
                    notifications={notifications}
                    isLoading={isLoading}
                    onMarkAsRead={handleMarkAsRead}
                    onClose={() => setIsOpen(false)}
                />
            </PopoverContent>
        </Popover>
    );
}

export default NotificationBell;
