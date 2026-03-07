"use client";

import { useAuth } from "@/components/AuthProvider";
import NotificationCenter from "@/components/NotificationCenter";
import DarkModeToggle from "@/components/DarkModeToggle";
import Link from "next/link";

export default function DashboardHeader() {
    const { user, logout } = useAuth();
    if (!user) return null;

    return (
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
                <Link href="/dashboard" className="text-lg font-bold tracking-tight text-black dark:text-white">
                    ProduceLink
                </Link>

                <nav className="hidden sm:flex items-center gap-5 text-sm text-neutral-500">
                    <Link href="/marketplace" className="hover:text-black dark:hover:text-white transition-colors">Market</Link>
                    <Link href="/analytics" className="hover:text-black dark:hover:text-white transition-colors">Analytics</Link>
                    <Link href="/chat" className="hover:text-black dark:hover:text-white transition-colors">Messages</Link>
                    <Link href={`/profile/${user.id}`} className="hover:text-black dark:hover:text-white transition-colors">Profile</Link>
                </nav>

                <div className="flex items-center gap-2">
                    <NotificationCenter />
                    <DarkModeToggle />
                    <button
                        onClick={logout}
                        className="ml-2 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-500 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}
