"use client";

import { useState, useEffect, use } from "react";
import StarRating from "@/components/StarRating";
import AppShell from "@/components/AppShell";

interface ProfileData {
    _id: string;
    name: string;
    email: string;
    role: string;
    location?: string;
    phone?: string;
    rating: { average: number; count: number };
    stats: Record<string, number>;
}

interface Activity {
    _id: string;
    type: string;
    description: string;
    date: string;
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`/api/profile/${id}`).then((r) => r.json()),
            fetch(`/api/profile/${id}/activity`).then((r) => r.json()),
        ])
            .then(([p, a]) => {
                setProfile(p);
                setActivities(a);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center text-neutral-400">
                Loading profile...
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center text-neutral-400">
                Profile not found
            </div>
        );
    }

    const roleLabel = { farmer: "Farmer", mandi: "Mandi Dealer", transporter: "Transporter" }[profile.role] || profile.role;

    return (
        <AppShell>
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-8">
                {/* Header card */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-2xl font-bold text-neutral-400 mb-4">
                                {profile.name.charAt(0).toUpperCase()}
                            </div>
                            <h1 className="text-2xl font-bold text-black dark:text-white">{profile.name}</h1>
                            <div className="text-sm text-neutral-500 mt-1">{roleLabel}</div>
                            {profile.location && (
                                <div className="text-sm text-neutral-400 mt-1">{profile.location}</div>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-2 mb-1">
                                <StarRating value={Math.round(profile.rating.average)} readonly size="sm" />
                                <span className="text-sm font-medium text-black dark:text-white">
                                    {profile.rating.average.toFixed(1)}
                                </span>
                            </div>
                            <div className="text-xs text-neutral-400">{profile.rating.count} reviews</div>
                        </div>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {Object.entries(profile.stats).map(([key, value]) => (
                        <div
                            key={key}
                            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-center"
                        >
                            <div className="text-2xl font-bold text-black dark:text-white">{value}</div>
                            <div className="text-xs text-neutral-400 mt-1 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</div>
                        </div>
                    ))}
                </div>

                {/* Recent activity */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Recent Activity</h2>
                    {activities.length === 0 ? (
                        <div className="text-sm text-neutral-400">No recent activity</div>
                    ) : (
                        <div className="space-y-3">
                            {activities.map((a) => (
                                <div key={a._id} className="flex items-start gap-3 py-2 border-b border-neutral-50 dark:border-neutral-800 last:border-0">
                                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-medium text-neutral-500">
                                            {a.type === "harvest" ? "H" : a.type === "bid" ? "B" : "D"}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm text-black dark:text-white">{a.description}</div>
                                        <div className="text-[10px] text-neutral-400 mt-0.5">
                                            {new Date(a.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
