"use client";

import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [loading, user, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-neutral-300 border-t-black dark:border-neutral-600 dark:border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="flex min-h-screen bg-neutral-50 dark:bg-black">
            <Sidebar />
            <main className="flex-1 min-w-0 lg:pl-0">
                {children}
            </main>
        </div>
    );
}
