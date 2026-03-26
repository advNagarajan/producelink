"use client";

import { useState, useEffect } from "react";

interface GovtComparison {
    farmerPrice: number;
    govtAvgPrice: number;
    govtMinPrice: number;
    govtMaxPrice: number;
    differencePerKg: number;
    differencePercent: number;
    badge: string;
    badgeLabel: string;
    commodity: string;
    state: string;
    marketsReporting: number;
    note: string;
}

interface Props {
    harvestId: string;
    compact?: boolean;
}

const badgeStyles: Record<string, { bg: string; text: string }> = {
    well_above: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
    above: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
    fair: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
    below: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
    well_below: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400" },
};

export default function GovtPriceBadge({ harvestId, compact = false }: Props) {
    const [data, setData] = useState<GovtComparison | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/govt-prices/compare/${harvestId}`);
                if (res.ok) {
                    const json = await res.json();
                    if (!cancelled && json.comparison) setData(json.comparison);
                }
            } catch {
                // silent — badge just won't show
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [harvestId]);

    if (loading || !data) return null;

    const style = badgeStyles[data.badge] || badgeStyles.fair;
    const arrow = data.differencePercent > 0 ? "↑" : data.differencePercent < 0 ? "↓" : "→";

    if (compact) {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
                {arrow} {Math.abs(data.differencePercent).toFixed(0)}% vs Govt
            </span>
        );
    }

    return (
        <div className="mt-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${style.bg} ${style.text} hover:opacity-80`}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {data.badgeLabel} ({arrow}{Math.abs(data.differencePercent).toFixed(1)}%)
                <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className={`mt-2 p-3 rounded-xl border text-xs space-y-2 ${style.bg} border-current/10`}>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <div className="text-neutral-500 dark:text-neutral-400">Your Price</div>
                            <div className="font-bold text-black dark:text-white text-sm">Rs {data.farmerPrice}/kg</div>
                        </div>
                        <div>
                            <div className="text-neutral-500 dark:text-neutral-400">Govt Avg</div>
                            <div className="font-bold text-black dark:text-white text-sm">Rs {data.govtAvgPrice}/kg</div>
                        </div>
                        <div>
                            <div className="text-neutral-500 dark:text-neutral-400">Govt Range</div>
                            <div className="font-medium text-neutral-700 dark:text-neutral-300">Rs {data.govtMinPrice} — Rs {data.govtMaxPrice}</div>
                        </div>
                        <div>
                            <div className="text-neutral-500 dark:text-neutral-400">Markets</div>
                            <div className="font-medium text-neutral-700 dark:text-neutral-300">{data.marketsReporting} reporting</div>
                        </div>
                    </div>
                    {/* Price bar visualization */}
                    <div className="pt-1">
                        <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                            <span>Rs {data.govtMinPrice}</span>
                            <span>Rs {data.govtMaxPrice}</span>
                        </div>
                        <div className="relative h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full">
                            {/* Govt range bar */}
                            <div className="absolute inset-0 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
                            {/* Farmer price marker */}
                            {data.govtMaxPrice > data.govtMinPrice && (
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-black dark:bg-white rounded-full border-2 border-white dark:border-black shadow"
                                    style={{
                                        left: `${Math.min(100, Math.max(0, ((data.farmerPrice - data.govtMinPrice) / (data.govtMaxPrice - data.govtMinPrice)) * 100))}%`,
                                    }}
                                />
                            )}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-1 text-center">
                            ● Your price vs govt range
                        </div>
                    </div>
                    <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-200 dark:border-neutral-700">
                        Source: {data.commodity} — {data.state} — data.gov.in / Agmarknet
                    </div>
                </div>
            )}
        </div>
    );
}
