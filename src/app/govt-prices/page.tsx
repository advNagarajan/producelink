"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    LineChart, Line, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";
import AppShell from "@/components/AppShell";

interface GovtRecord {
    state: string;
    district: string;
    market: string;
    commodity: string;
    variety: string;
    arrivalDate: string;
    minPrice: number;
    maxPrice: number;
    modalPrice: number;
}

interface GovtStats {
    avgModalPrice: number;
    lowestPrice: number;
    highestPrice: number;
    medianModalPrice: number;
    marketsReporting: number;
    priceSpread: number;
}

interface PlatformHistoryPoint {
    date: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    listings: number;
}

interface ModelInfo {
    status: string;
    type?: string;
    trainedAt?: string;
    sampleCount?: number;
    r2Score?: number;
    mae?: number;
    featureImportances?: Record<string, number>;
    cropCategories?: string[];
    priceStats?: Record<string, { min: number; max: number; mean: number; count: number }>;
}

const commodities = [
    "Tomato", "Potato", "Onion", "Rice", "Wheat", "Corn", "Apple", "Mango", "Banana",
    "Cabbage", "Cauliflower", "Brinjal", "Garlic", "Ginger", "Peas", "Carrot",
    "Capsicum", "Lemon", "Grapes", "Orange", "Pomegranate", "Coconut",
];

const states = [
    "", "Andhra Pradesh", "Bihar", "Chhattisgarh", "Delhi", "Gujarat", "Haryana",
    "Himachal Pradesh", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
    "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh",
    "Uttarakhand", "West Bengal",
];

export default function GovtPricesPage() {
    const { dark } = useTheme();
    const [commodity, setCommodity] = useState("Tomato");
    const [state, setState] = useState("");
    const [records, setRecords] = useState<GovtRecord[]>([]);
    const [stats, setStats] = useState<GovtStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [trendData, setTrendData] = useState<PlatformHistoryPoint[]>([]);
    const [govtCurrent, setGovtCurrent] = useState<Record<string, number> | null>(null);
    const [loadingTrend, setLoadingTrend] = useState(false);

    const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
    const [activeView, setActiveView] = useState<"prices" | "compare" | "model">("prices");

    const fetchPrices = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({ commodity });
            if (state) params.set("state", state);
            const res = await fetch(`/api/govt-prices?${params}`);
            if (res.ok) {
                const data = await res.json();
                setRecords(data.records || []);
                setStats(data.stats || null);
            } else {
                const data = await res.json();
                setError(data.detail || data.message || "Failed to fetch prices");
                setRecords([]);
                setStats(null);
            }
        } catch {
            setError("Could not connect to the server");
        } finally {
            setLoading(false);
        }
    }, [commodity, state]);

    const fetchTrend = useCallback(async () => {
        setLoadingTrend(true);
        try {
            const params = new URLSearchParams({ commodity });
            if (state) params.set("state", state);
            const res = await fetch(`/api/govt-prices/trend?${params}`);
            if (res.ok) {
                const data = await res.json();
                setTrendData(data.platformHistory || []);
                setGovtCurrent(data.govtCurrent || null);
            }
        } catch { /* silent */ }
        setLoadingTrend(false);
    }, [commodity, state]);

    const fetchModelInfo = useCallback(async () => {
        try {
            const res = await fetch("/api/predict/ml/model-info");
            if (res.ok) setModelInfo(await res.json());
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchPrices();
        fetchTrend();
    }, [fetchPrices, fetchTrend]);

    useEffect(() => {
        if (activeView === "model") fetchModelInfo();
    }, [activeView, fetchModelInfo]);

    // Aggregate by state for the comparison chart
    const stateAggregation = records.reduce<Record<string, { total: number; count: number; min: number; max: number }>>((acc, r) => {
        if (!acc[r.state]) acc[r.state] = { total: 0, count: 0, min: Infinity, max: 0 };
        acc[r.state].total += r.modalPrice;
        acc[r.state].count += 1;
        acc[r.state].min = Math.min(acc[r.state].min, r.minPrice);
        acc[r.state].max = Math.max(acc[r.state].max, r.maxPrice);
        return acc;
    }, {});

    const stateChartData = Object.entries(stateAggregation)
        .map(([st, d]) => ({ state: st, avgPrice: Math.round(d.total / d.count / 100), minPrice: Math.round(d.min / 100), maxPrice: Math.round(d.max / 100), markets: d.count }))
        .sort((a, b) => b.avgPrice - a.avgPrice)
        .slice(0, 15);

    // Market scatter data
    const scatterData = records.slice(0, 40).map(r => ({
        market: `${r.market}, ${r.district}`,
        modalPrice: Math.round(r.modalPrice / 100),
        volume: Math.random() * 100 + 10, // visual only
        variety: r.variety,
    }));

    const views = [
        { key: "prices" as const, label: "Live Prices" },
        { key: "compare" as const, label: "State Comparison" },
        { key: "model" as const, label: "ML Model" },
    ];

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
                <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-black dark:text-white">Government Mandi Prices</h1>
                        <p className="text-neutral-500 mt-1">Live wholesale prices from Agmarknet / data.gov.in</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Live Data Feed
                    </div>
                </div>

                {/* View tabs */}
                <div className="flex gap-1 mb-6">
                    {views.map(v => (
                        <button key={v.key} onClick={() => setActiveView(v.key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                activeView === v.key
                                    ? "bg-black dark:bg-white text-white dark:text-black"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            }`}>
                            {v.label}
                        </button>
                    ))}
                </div>

                {/* Commodity + State selectors */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs text-neutral-400 mb-1 block">Commodity</label>
                        <div className="flex gap-2 flex-wrap">
                            {commodities.slice(0, 9).map(c => (
                                <button key={c} onClick={() => setCommodity(c)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        c === commodity
                                            ? "bg-black dark:bg-white text-white dark:text-black"
                                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                    }`}>
                                    {c}
                                </button>
                            ))}
                            <select value={commodity} onChange={e => setCommodity(e.target.value)}
                                className="px-3 py-1.5 rounded-full text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white">
                                {commodities.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="w-48">
                        <label className="text-xs text-neutral-400 mb-1 block">State</label>
                        <select value={state} onChange={e => setState(e.target.value)}
                            className="w-full h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white px-3 text-sm">
                            <option value="">All India</option>
                            {states.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 text-sm text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* ═══ LIVE PRICES VIEW ═══ */}
                {activeView === "prices" && (
                    <div className="space-y-6">
                        {/* Stats cards */}
                        {stats && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {[
                                    { label: "Avg Price", value: (stats.avgModalPrice / 100).toFixed(1), prefix: "Rs ", suffix: "/kg", accent: true },
                                    { label: "Lowest", value: (stats.lowestPrice / 100).toFixed(1), prefix: "Rs ", suffix: "/kg" },
                                    { label: "Highest", value: (stats.highestPrice / 100).toFixed(1), prefix: "Rs ", suffix: "/kg" },
                                    { label: "Median", value: (stats.medianModalPrice / 100).toFixed(1), prefix: "Rs ", suffix: "/kg" },
                                    { label: "Markets", value: stats.marketsReporting?.toString() ?? "N/A", prefix: "", suffix: " mandis" },
                                    { label: "Spread", value: (stats.priceSpread / 100).toFixed(1), prefix: "Rs ", suffix: "/kg" },
                                ].map(s => (
                                    <div key={s.label} className={`rounded-2xl p-4 border transition-all hover:shadow-sm ${
                                        s.accent
                                            ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700"
                                    }`}>
                                        <div className="text-xs font-medium opacity-60 mb-1">{s.label}</div>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-[11px] opacity-50">{s.prefix}</span>
                                            <span className="text-xl font-bold tabular-nums">{s.value}</span>
                                            <span className="text-[11px] opacity-50">{s.suffix}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Market Insights */}
                        {records.length > 0 && stats && (() => {
                            const sorted = [...records].sort((a, b) => a.modalPrice - b.modalPrice);
                            const cheapest = sorted[0];
                            const priciest = sorted[sorted.length - 1];
                            const volatility = stats.priceSpread / stats.avgModalPrice * 100;
                            const statesCount = new Set(records.map(r => r.state)).size;
                            const varietiesCount = new Set(records.map(r => r.variety)).size;
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Cheapest market */}
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Cheapest Market</div>
                                                <div className="font-semibold text-black dark:text-white truncate">{cheapest.market}, {cheapest.district}</div>
                                                <div className="text-xs text-neutral-400 mt-0.5">{cheapest.state}</div>
                                                <div className="mt-2 text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">Rs {(cheapest.modalPrice / 100).toFixed(1)}/kg</div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Most expensive market */}
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Most Expensive Market</div>
                                                <div className="font-semibold text-black dark:text-white truncate">{priciest.market}, {priciest.district}</div>
                                                <div className="text-xs text-neutral-400 mt-0.5">{priciest.state}</div>
                                                <div className="mt-2 text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">Rs {(priciest.modalPrice / 100).toFixed(1)}/kg</div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Quick facts row */}
                                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                                            <div className="text-2xl font-bold text-black dark:text-white tabular-nums">{statesCount}</div>
                                            <div className="text-xs text-neutral-500 dark:text-neutral-400">States Reporting</div>
                                        </div>
                                        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                                            <div className="text-2xl font-bold text-black dark:text-white tabular-nums">{varietiesCount}</div>
                                            <div className="text-xs text-neutral-500 dark:text-neutral-400">Varieties Listed</div>
                                        </div>
                                        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                                            <div className="text-2xl font-bold text-black dark:text-white tabular-nums">{volatility.toFixed(0)}%</div>
                                            <div className="text-xs text-neutral-500 dark:text-neutral-400">Price Volatility</div>
                                        </div>
                                        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                                            <div className="text-2xl font-bold text-black dark:text-white tabular-nums">Rs {(stats.priceSpread / 100).toFixed(1)}</div>
                                            <div className="text-xs text-neutral-500 dark:text-neutral-400">Price Range /kg</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Market scatter distribution */}
                        {scatterData.length > 0 && (
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                                <h2 className="text-lg font-semibold text-black dark:text-white mb-1">Market Price Distribution</h2>
                                <p className="text-xs text-neutral-400 mb-4">Each dot represents a mandi — showing price spread across markets</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <ScatterChart>
                                        <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#404040" : "#e5e5e5"} />
                                        <XAxis dataKey="market" tick={false} stroke={dark ? "#404040" : "#e5e5e5"} label={{ value: "Markets", position: "insideBottom", offset: -5, fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} />
                                        <YAxis dataKey="modalPrice" tick={{ fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} stroke={dark ? "#404040" : "#e5e5e5"} label={{ value: "Rs/kg", angle: -90, position: "insideLeft", fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} />
                                        <ZAxis dataKey="volume" range={[20, 200]} />
                                        <Tooltip contentStyle={{ background: dark ? "#171717" : "white", border: `1px solid ${dark ? "#404040" : "#e5e5e5"}`, borderRadius: "12px", fontSize: "11px", color: dark ? "#fafafa" : "#0a0a0a" }} />
                                        <Scatter data={scatterData} fill={dark ? "#fafafa" : "#000"} fillOpacity={0.7} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Platform vs Govt price trend */}
                        {(trendData.length > 0 || govtCurrent) && (
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                                <h2 className="text-lg font-semibold text-black dark:text-white mb-1">Platform vs Govt Price</h2>
                                <p className="text-xs text-neutral-400 mb-4">Your marketplace listing prices compared to government wholesale rates</p>
                                {trendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart data={trendData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#404040" : "#e5e5e5"} />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} stroke={dark ? "#404040" : "#e5e5e5"} />
                                            <YAxis tick={{ fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} stroke={dark ? "#404040" : "#e5e5e5"} />
                                            <Tooltip contentStyle={{ background: dark ? "#171717" : "white", border: `1px solid ${dark ? "#404040" : "#e5e5e5"}`, borderRadius: "12px", fontSize: "11px", color: dark ? "#fafafa" : "#0a0a0a" }} />
                                            <Line type="monotone" dataKey="avgPrice" stroke={dark ? "#fafafa" : "#000"} strokeWidth={2} dot={{ r: 2 }} name="Platform Avg (Rs/kg)" />
                                            <Line type="monotone" dataKey="minPrice" stroke={dark ? "#737373" : "#a3a3a3"} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Platform Min" />
                                            <Line type="monotone" dataKey="maxPrice" stroke={dark ? "#a3a3a3" : "#737373"} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Platform Max" />
                                            <Legend wrapperStyle={{ color: dark ? "#d4d4d4" : "#525252", fontSize: "11px" }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-40 flex items-center justify-center text-neutral-400 text-sm">No platform history for {commodity}</div>
                                )}
                                {govtCurrent && Object.keys(govtCurrent).length > 0 && (
                                    <div className="mt-3 flex items-center gap-4 text-xs">
                                        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-2">
                                            <span className="text-neutral-500">Govt Avg Today:</span>
                                            <span className="ml-1 font-bold text-black dark:text-white">Rs {govtCurrent.avgModalPrice}/kg</span>
                                        </div>
                                        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-2">
                                            <span className="text-neutral-500">Govt Range:</span>
                                            <span className="ml-1 font-bold text-black dark:text-white">Rs {govtCurrent.minPrice} — Rs {govtCurrent.maxPrice}/kg</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Market-wise price table */}
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h2 className="text-lg font-semibold text-black dark:text-white">Market Prices — {commodity}</h2>
                                    <p className="text-xs text-neutral-400 mt-0.5">
                                        {records.length} markets reporting
                                        <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">|</span>
                                        Quintal prices (Rs/q) &amp; per-kg equivalent
                                    </p>
                                </div>
                                <Button variant="outline" className="rounded-full text-xs h-8 px-4" onClick={fetchPrices} disabled={loading}>
                                    {loading ? (
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-3 border-2 border-neutral-300 border-t-black dark:border-t-white rounded-full animate-spin" />
                                            Refreshing
                                        </span>
                                    ) : "Refresh"}
                                </Button>
                            </div>

                            {loading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                                    ))}
                                </div>
                            ) : records.length === 0 ? (
                                <div className="py-12 text-center text-neutral-400">
                                    No market data found for {commodity}{state ? ` in ${state}` : ""}. Try a different commodity or state.
                                </div>
                            ) : (
                                <div className="overflow-x-auto -mx-6">
                                    <table className="w-full text-sm min-w-[900px]">
                                        <thead>
                                            <tr className="border-b border-neutral-200 dark:border-neutral-700 text-left text-[11px] uppercase tracking-wider text-neutral-400">
                                                <th className="pb-3 pl-6 font-medium w-[130px]">State</th>
                                                <th className="pb-3 font-medium w-[130px]">District</th>
                                                <th className="pb-3 font-medium">Market</th>
                                                <th className="pb-3 font-medium w-[80px]">Variety</th>
                                                <th className="pb-3 font-medium text-right w-[90px]">Min</th>
                                                <th className="pb-3 font-medium text-right w-[90px]">Max</th>
                                                <th className="pb-3 font-medium text-right w-[90px]">Modal</th>
                                                <th className="pb-3 font-medium text-right w-[80px]">Per Kg</th>
                                                <th className="pb-3 pr-6 font-medium text-right w-[100px]">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.map((r, i) => {
                                                const perKg = (r.modalPrice / 100).toFixed(1);
                                                return (
                                                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors group">
                                                        <td className="py-3 pl-6 text-neutral-600 dark:text-neutral-400">{r.state}</td>
                                                        <td className="py-3 text-neutral-500 dark:text-neutral-500">{r.district}</td>
                                                        <td className="py-3 font-medium text-black dark:text-white">{r.market}</td>
                                                        <td className="py-3">
                                                            <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
                                                                {r.variety}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 text-right text-neutral-500 dark:text-neutral-400 tabular-nums">
                                                            {r.minPrice.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 text-right text-neutral-500 dark:text-neutral-400 tabular-nums">
                                                            {r.maxPrice.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 text-right font-bold text-black dark:text-white tabular-nums">
                                                            {r.modalPrice.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 text-right tabular-nums">
                                                            <span className="inline-block px-2 py-0.5 rounded-md bg-black dark:bg-white text-white dark:text-black text-xs font-semibold">
                                                                Rs {perKg}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 pr-6 text-right text-neutral-400 text-xs tabular-nums whitespace-nowrap">
                                                            {r.arrivalDate}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Variety price breakdown */}
                        {records.length > 0 && (() => {
                            const varietyMap = records.reduce<Record<string, { total: number; count: number; min: number; max: number }>>((acc, r) => {
                                const v = r.variety || "Other";
                                if (!acc[v]) acc[v] = { total: 0, count: 0, min: Infinity, max: 0 };
                                acc[v].total += r.modalPrice;
                                acc[v].count += 1;
                                acc[v].min = Math.min(acc[v].min, r.modalPrice);
                                acc[v].max = Math.max(acc[v].max, r.modalPrice);
                                return acc;
                            }, {});
                            const varietyData = Object.entries(varietyMap)
                                .map(([v, d]) => ({ variety: v, avg: Math.round(d.total / d.count / 100), min: Math.round(d.min / 100), max: Math.round(d.max / 100), markets: d.count }))
                                .sort((a, b) => b.markets - a.markets)
                                .slice(0, 8);
                            if (varietyData.length <= 1) return null;
                            return (
                                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                                    <h2 className="text-lg font-semibold text-black dark:text-white mb-1">Price by Variety</h2>
                                    <p className="text-xs text-neutral-400 mb-4">How different varieties of {commodity} are priced across mandis</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {varietyData.map(v => (
                                            <div key={v.variety} className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3">
                                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 truncate">{v.variety}</div>
                                                <div className="text-lg font-bold text-black dark:text-white tabular-nums">Rs {v.avg}/kg</div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: `${(v.avg / (varietyData[0]?.avg || 1)) * 100}%` }} />
                                                    </div>
                                                    <span className="text-[10px] text-neutral-400 tabular-nums">{v.markets}</span>
                                                </div>
                                                <div className="text-[10px] text-neutral-400 mt-1 tabular-nums">Rs {v.min} — Rs {v.max}/kg</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Info banner */}
                        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <div className="font-medium text-sm text-black dark:text-white mb-1">About Government Mandi Prices</div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                    Prices are sourced from Agmarknet via data.gov.in — India's official open data portal. Modal price is the most common trading price in a mandi on a given day. 
                                    Prices are in Rs per quintal (100 kg). Per-kg figures are derived by dividing the quintal price by 100. Data is cached for 30 minutes and refreshed on demand.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ STATE COMPARISON VIEW ═══ */}
                {activeView === "compare" && (
                    <div className="space-y-6">
                        {loading ? (
                            <div className="h-80 flex items-center justify-center text-neutral-400">Loading comparison data...</div>
                        ) : stateChartData.length === 0 ? (
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-12 text-center text-neutral-400">
                                No data available for comparison. Try fetching prices first.
                            </div>
                        ) : (
                            <>
                                {/* State quick stats */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
                                        <div className="text-2xl font-bold text-black dark:text-white tabular-nums">{stateChartData.length}</div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400">States with Data</div>
                                    </div>
                                    <div className="bg-black dark:bg-white rounded-xl p-4 text-white dark:text-black">
                                        <div className="text-2xl font-bold tabular-nums">{stateChartData[0]?.state || "—"}</div>
                                        <div className="text-xs opacity-60">Highest Avg Price</div>
                                    </div>
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
                                        <div className="text-2xl font-bold text-black dark:text-white tabular-nums">{stateChartData[stateChartData.length - 1]?.state || "—"}</div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Lowest Avg Price</div>
                                    </div>
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
                                        <div className="text-2xl font-bold text-black dark:text-white tabular-nums">
                                            {stateChartData.length >= 2 ? `Rs ${stateChartData[0].avgPrice - stateChartData[stateChartData.length - 1].avgPrice}` : "—"}
                                        </div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Max State Spread /kg</div>
                                    </div>
                                </div>

                                {/* State-wise bar chart */}
                                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                                    <h2 className="text-lg font-semibold text-black dark:text-white mb-1">State-wise Price Comparison — {commodity}</h2>
                                    <p className="text-xs text-neutral-400 mb-4">Average government wholesale prices (Rs/kg) by state</p>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={stateChartData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#404040" : "#e5e5e5"} />
                                            <XAxis type="number" tick={{ fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} stroke={dark ? "#404040" : "#e5e5e5"} />
                                            <YAxis dataKey="state" type="category" width={120} tick={{ fontSize: 10, fill: dark ? "#d4d4d4" : "#525252" }} stroke={dark ? "#404040" : "#e5e5e5"} />
                                            <Tooltip contentStyle={{ background: dark ? "#171717" : "white", border: `1px solid ${dark ? "#404040" : "#e5e5e5"}`, borderRadius: "12px", fontSize: "11px", color: dark ? "#fafafa" : "#0a0a0a" }} />
                                            <Bar dataKey="avgPrice" fill={dark ? "#fafafa" : "#000"} radius={[0, 6, 6, 0]} name="Avg Price (Rs/kg)" />
                                            <Bar dataKey="maxPrice" fill={dark ? "#737373" : "#a3a3a3"} radius={[0, 6, 6, 0]} name="Max Price (Rs/kg)" />
                                            <Legend wrapperStyle={{ color: dark ? "#d4d4d4" : "#525252", fontSize: "11px" }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* State comparison table */}
                                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                                    <h2 className="text-lg font-semibold text-black dark:text-white mb-4">State Summary</h2>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-neutral-200 dark:border-neutral-700 text-left text-xs text-neutral-500">
                                                    <th className="pb-2 font-medium">State</th>
                                                    <th className="pb-2 font-medium text-right">Avg (Rs/kg)</th>
                                                    <th className="pb-2 font-medium text-right">Min (Rs/kg)</th>
                                                    <th className="pb-2 font-medium text-right">Max (Rs/kg)</th>
                                                    <th className="pb-2 font-medium text-right">Markets</th>
                                                    <th className="pb-2 font-medium">Price Bar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stateChartData.map(s => {
                                                    const maxVal = stateChartData[0]?.avgPrice || 1;
                                                    return (
                                                        <tr key={s.state} className="border-b border-neutral-50 dark:border-neutral-800">
                                                            <td className="py-2.5 font-medium text-black dark:text-white">{s.state}</td>
                                                            <td className="py-2.5 text-right font-bold text-black dark:text-white">Rs {s.avgPrice}</td>
                                                            <td className="py-2.5 text-right text-neutral-500">Rs {s.minPrice}</td>
                                                            <td className="py-2.5 text-right text-neutral-500">Rs {s.maxPrice}</td>
                                                            <td className="py-2.5 text-right text-neutral-500">{s.markets}</td>
                                                            <td className="py-2.5 w-32">
                                                                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: `${(s.avgPrice / maxVal) * 100}%` }} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Trade tip */}
                                {stateChartData.length >= 2 && (
                                    <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-black dark:text-white mb-1">Trade Insight</div>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                                {commodity} prices are highest in <span className="font-semibold text-black dark:text-white">{stateChartData[0].state}</span> (Rs {stateChartData[0].avgPrice}/kg avg)
                                                and lowest in <span className="font-semibold text-black dark:text-white">{stateChartData[stateChartData.length - 1].state}</span> (Rs {stateChartData[stateChartData.length - 1].avgPrice}/kg avg).
                                                The inter-state price difference of Rs {stateChartData[0].avgPrice - stateChartData[stateChartData.length - 1].avgPrice}/kg may represent a transport or arbitrage opportunity.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ═══ ML MODEL VIEW ═══ */}
                {activeView === "model" && (
                    <div className="space-y-6">
                        {!modelInfo ? (
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-12 text-center">
                                <div className="text-neutral-400">Loading model information...</div>
                            </div>
                        ) : modelInfo.status === "not_trained" ? (
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <div className="text-neutral-500 text-lg font-medium mb-2">Model Not Trained Yet</div>
                                <p className="text-neutral-400 text-sm mb-4">The ML model will be automatically trained when you request your first price prediction from the Farmer Dashboard.</p>
                            </div>
                        ) : (
                            <>
                                {/* Model stats */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: "Model Type", value: modelInfo.type || "—" },
                                        { label: "R² Score", value: modelInfo.r2Score?.toFixed(4) || "—" },
                                        { label: "MAE", value: modelInfo.mae ? `Rs ${modelInfo.mae}` : "—" },
                                        { label: "Training Samples", value: modelInfo.sampleCount?.toString() || "—" },
                                    ].map(s => (
                                        <div key={s.label} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
                                            <div className="text-lg font-bold text-black dark:text-white">{s.value}</div>
                                            <div className="text-xs text-neutral-500">{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Feature importances */}
                                {modelInfo.featureImportances && Object.keys(modelInfo.featureImportances).length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                                        <h2 className="text-lg font-semibold text-black dark:text-white mb-1">Feature Importances</h2>
                                        <p className="text-xs text-neutral-400 mb-4">Which factors matter most for price prediction</p>
                                        <div className="space-y-2">
                                            {Object.entries(modelInfo.featureImportances)
                                                .sort(([, a], [, b]) => b - a)
                                                .slice(0, 12)
                                                .map(([feat, imp]) => {
                                                    const maxImp = Object.values(modelInfo.featureImportances!)[0] || 1;
                                                    return (
                                                        <div key={feat} className="flex items-center gap-3">
                                                            <div className="w-36 text-right text-xs text-neutral-600 dark:text-neutral-400 truncate">{feat.replace("crop_", "").replace("state_", "").replace("_", " ")}</div>
                                                            <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                                <div className="h-full bg-black dark:bg-white rounded-full transition-all duration-500" style={{ width: `${(imp / maxImp) * 100}%` }} />
                                                            </div>
                                                            <div className="w-12 text-xs text-neutral-500 text-right">{(imp * 100).toFixed(1)}%</div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Crop price stats */}
                                {modelInfo.priceStats && Object.keys(modelInfo.priceStats).length > 0 && (
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                                        <h2 className="text-lg font-semibold text-black dark:text-white mb-1">Training Data — Crop Price Distribution</h2>
                                        <p className="text-xs text-neutral-400 mb-4">Min/Max/Mean prices from historical data used for training</p>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={Object.entries(modelInfo.priceStats).map(([crop, s]) => ({ crop, ...s }))}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#404040" : "#e5e5e5"} />
                                                <XAxis dataKey="crop" tick={{ fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} stroke={dark ? "#404040" : "#e5e5e5"} />
                                                <YAxis tick={{ fontSize: 10, fill: dark ? "#a3a3a3" : "#737373" }} stroke={dark ? "#404040" : "#e5e5e5"} />
                                                <Tooltip contentStyle={{ background: dark ? "#171717" : "white", border: `1px solid ${dark ? "#404040" : "#e5e5e5"}`, borderRadius: "12px", fontSize: "11px", color: dark ? "#fafafa" : "#0a0a0a" }} />
                                                <Bar dataKey="mean" fill={dark ? "#fafafa" : "#000"} radius={[6, 6, 0, 0]} name="Mean Price" />
                                                <Bar dataKey="max" fill={dark ? "#737373" : "#a3a3a3"} radius={[6, 6, 0, 0]} name="Max Price" />
                                                <Bar dataKey="min" fill={dark ? "#525252" : "#d4d4d4"} radius={[6, 6, 0, 0]} name="Min Price" />
                                                <Legend wrapperStyle={{ color: dark ? "#d4d4d4" : "#525252", fontSize: "11px" }} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Last trained */}
                                <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm text-black dark:text-white mb-1">ML Price Model</div>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                            This model uses a Gradient Boosting Regressor trained on historical harvest pricing data. Features include crop type, grade, quantity, month, and state.
                                            The model is automatically retrained when you request predictions from the Farmer Dashboard.
                                            {modelInfo.trainedAt && <span className="block mt-1">Last trained: {new Date(modelInfo.trainedAt).toLocaleString()}</span>}
                                            {modelInfo.cropCategories && modelInfo.cropCategories.length > 0 && <span className="block mt-0.5">Crops: {modelInfo.cropCategories.join(", ")}</span>}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
