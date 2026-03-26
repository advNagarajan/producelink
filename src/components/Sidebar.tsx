"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import NotificationCenter from "@/components/NotificationCenter";
import DarkModeToggle from "@/components/DarkModeToggle";

const roleLabels: Record<string, string> = {
    farmer: "Farmer",
    mandi: "Mandi Owner",
    transporter: "Transporter",
};

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

function navItems(role: string, userId: string): NavItem[] {
    const items: NavItem[] = [
        {
            label: "Dashboard",
            href: role === "farmer" ? "/dashboard/farmer" : role === "mandi" ? "/dashboard/mandi" : "/dashboard/transporter",
            icon: (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            ),
        },
    ];

    if (role === "farmer") {
        items.push({
            label: "Marketplace",
            href: "/marketplace",
            icon: (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
            ),
        });
    }

    items.push({
        label: "Analytics",
        href: "/analytics",
        icon: (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
    });

    items.push({
        label: "Govt Prices",
        href: "/govt-prices",
        icon: (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    });

    items.push({
        label: "Messages",
        href: "/chat",
        icon: (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
    });

    items.push({
        label: "Profile",
        href: `/profile/${userId}`,
        icon: (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    });

    return items;
}

export default function Sidebar() {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    if (!user) return null;

    const items = navItems(user.role, user.id);

    const isActive = (href: string) => {
        if (href.startsWith("/dashboard/")) return pathname === href;
        if (href.startsWith("/profile/")) return pathname.startsWith("/profile/");
        return pathname === href || pathname.startsWith(href + "/");
    };

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Branding */}
            <div className={`px-5 h-16 flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 shrink-0 ${collapsed ? "justify-center px-3" : ""}`}>
                <div className="w-8 h-8 rounded-lg bg-black dark:bg-white flex items-center justify-center shrink-0">
                    <span className="text-white dark:text-black text-xs font-bold">PL</span>
                </div>
                {!collapsed && (
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-black dark:text-white tracking-tight">ProduceLink</div>
                        <div className="text-[10px] text-neutral-400 leading-none">{roleLabels[user.role] || user.role}</div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group
                                ${active
                                    ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                                    : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                                }
                                ${collapsed ? "justify-center px-2" : ""}
                            `}
                            title={collapsed ? item.label : undefined}
                        >
                            <span className={`shrink-0 ${active ? "text-white dark:text-black" : "text-neutral-400 dark:text-neutral-500 group-hover:text-black dark:group-hover:text-white"}`}>
                                {item.icon}
                            </span>
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom controls */}
            <div className={`px-3 py-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2 shrink-0 ${collapsed ? "px-2" : ""}`}>
                <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2 px-1"}`}>
                    <NotificationCenter />
                    <DarkModeToggle />
                    {!collapsed && (
                        <button
                            onClick={() => setCollapsed(true)}
                            className="ml-auto w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
                            title="Collapse sidebar"
                        >
                            <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                </div>

                {collapsed && (
                    <button
                        onClick={() => setCollapsed(false)}
                        className="w-full flex justify-center py-1"
                        title="Expand sidebar"
                    >
                        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* User info + logout */}
                <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${collapsed ? "justify-center px-0" : ""}`}>
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-300 shrink-0">
                        {user.name?.charAt(0).toUpperCase()}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-black dark:text-white truncate">{user.name}</div>
                            <div className="text-[10px] text-neutral-400 truncate">{user.email}</div>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className={`shrink-0 w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors group ${collapsed ? "" : ""}`}
                        title="Logout"
                    >
                        <svg className="w-4 h-4 text-neutral-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-center"
            >
                <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-neutral-950 shadow-2xl">
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center"
                        >
                            <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        {sidebarContent}
                    </div>
                </div>
            )}

            {/* Desktop sidebar */}
            <aside className={`hidden lg:flex flex-col shrink-0 bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 h-screen sticky top-0 transition-all duration-300 ${collapsed ? "w-[68px]" : "w-60"}`}>
                {sidebarContent}
            </aside>
        </>
    );
}
