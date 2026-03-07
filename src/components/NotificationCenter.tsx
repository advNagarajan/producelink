"use client";

import { useState, useEffect, useRef } from "react";

interface Notification {
    _id: string;
    title: string;
    body: string;
    link: string;
    read: boolean;
    createdAt: string;
}

function timeAgo(dateStr: string) {
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationCenter() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    const fetchUnread = async () => {
        try {
            const res = await fetch("/api/notifications/unread-count");
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.count);
            }
        } catch { /* ignore */ }
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) setNotifications(await res.json());
        } catch { /* ignore */ }
    };

    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, 15000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [open]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleMarkAllRead = async () => {
        await fetch("/api/notifications/read-all", { method: "POST" });
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const handleClick = async (n: Notification) => {
        if (!n.read) {
            await fetch(`/api/notifications/${n._id}/read`, { method: "PATCH" });
            setNotifications((prev) =>
                prev.map((x) => (x._id === n._id ? { ...x, read: true } : x))
            );
            setUnreadCount((c) => Math.max(c - 1, 0));
        }
        if (n.link) {
            window.location.href = n.link;
        }
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="relative w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
            >
                <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-12 w-80 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                        <h3 className="font-semibold text-sm text-black dark:text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} className="text-xs text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-10 text-center text-sm text-neutral-400">No notifications yet</div>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n._id}
                                    onClick={() => handleClick(n)}
                                    className={`w-full text-left px-4 py-3 border-b border-neutral-50 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors
                                        ${!n.read ? "bg-neutral-50/50 dark:bg-neutral-800/50" : ""}`}
                                >
                                    <div className="flex items-start gap-2">
                                        {!n.read && <div className="w-2 h-2 rounded-full bg-black dark:bg-white mt-1.5 shrink-0" />}
                                        <div className={!n.read ? "" : "ml-4"}>
                                            <div className="text-sm font-medium text-black dark:text-white">{n.title}</div>
                                            <div className="text-xs text-neutral-500 mt-0.5">{n.body}</div>
                                            <div className="text-[10px] text-neutral-400 mt-1">{timeAgo(n.createdAt)}</div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
