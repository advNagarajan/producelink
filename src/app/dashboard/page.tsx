"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function DashboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.replace("/login");
            return;
        }
        if (user.role === "farmer") router.replace("/dashboard/farmer");
        else if (user.role === "mandi_owner") router.replace("/dashboard/mandi");
        else if (user.role === "transporter") router.replace("/dashboard/transporter");
    }, [user, loading, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-black" />
        </div>
    );
}
