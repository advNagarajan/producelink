"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/AuthProvider";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import AppShell from "@/components/AppShell";
import FavoriteButton from "@/components/FavoriteButton";
import GovtPriceBadge from "@/components/GovtPriceBadge";
import AIOpsAssistant from "@/components/AIOpsAssistant";
import Link from "next/link";

interface Harvest {
    _id: string;
    farmerId: { _id: string; name: string };
    farmerTrust?: { score: number; label: string };
    cropType: string;
    quantity: number;
    qualityGrade: string;
    basePrice: number;
    location: string;
    status: string;
    createdAt: string;
    latestBid?: number;
}

interface MyBid {
    _id: string;
    harvestId: string;
    amount: number;
    dropoffLocation: string;
    status: "pending" | "accepted" | "rejected";
    createdAt: string;
}

type Tab = "browse" | "mybids";

function timeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
}

const gradeColors: Record<string, string> = {
    A: "bg-black text-white",
    B: "bg-neutral-700 text-white",
    C: "bg-neutral-300 text-black",
    D: "bg-neutral-100 text-neutral-500",
};

function trustClass(score: number) {
    if (score >= 85) return "bg-emerald-100 text-emerald-700";
    if (score >= 70) return "bg-teal-100 text-teal-700";
    if (score >= 55) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
}

export default function MandiDashboard() {
    const { user } = useAuth();
    const [marketHarvests, setMarketHarvests] = useState<Harvest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("browse");

    const [biddingHarvestId, setBiddingHarvestId] = useState<string | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [bidAmount, setBidAmount] = useState("");
    const [dropoffLocation, setDropoffLocation] = useState("");
    const [submittingBid, setSubmittingBid] = useState(false);
    const [bidError, setBidError] = useState("");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"newest" | "price_low" | "price_high" | "quantity">("newest");
    const [gradeFilter, setGradeFilter] = useState<string | null>(null);

    const [myBids, setMyBids] = useState<MyBid[]>([]);
    const [loadingBids, setLoadingBids] = useState(false);
    const [bidFilter, setBidFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");

    const [aiAdvice, setAiAdvice] = useState<Record<string, string>>({});
    const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

    const fetchBidAdvice = async (harvest: Harvest) => {
        setAiLoading(prev => ({ ...prev, [harvest._id]: true }));
        try {
            const res = await fetch("/api/predict/bid-advice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cropType: harvest.cropType,
                    location: harvest.location,
                    quantity: harvest.quantity,
                    basePrice: harvest.basePrice,
                    qualityGrade: harvest.qualityGrade,
                    latestBid: harvest.latestBid || null,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setAiAdvice(prev => ({ ...prev, [harvest._id]: data.advice }));
            }
        } catch { /* silent */ }
        setAiLoading(prev => ({ ...prev, [harvest._id]: false }));
    };

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchMarket = useCallback(async () => {
        try {
            const res = await fetch("/api/market");
            if (res.ok) {
                const data = await res.json();
                setMarketHarvests(Array.isArray(data) ? data : data.items || []);
            }
        } catch (err) {
            console.error("Failed to fetch market data", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMarket();
        const latestBidsRef = ref(database, "latestBids");
        const unsubscribe = onValue(latestBidsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setMarketHarvests((cur) =>
                    cur.map(h => data[h._id] ? { ...h, latestBid: data[h._id].amount } : h)
                );
            }
        });
        return () => unsubscribe();
    }, [fetchMarket]);

    const fetchMyBids = useCallback(async () => {
        setLoadingBids(true);
        const allBids: MyBid[] = [];
        for (const h of marketHarvests) {
            try {
                const res = await fetch(`/api/bids?harvestId=${h._id}`);
                if (res.ok) {
                    const bids = await res.json();
                    bids.forEach((b: MyBid & { mandiOwnerId?: { _id: string } }) => {
                        if (b.mandiOwnerId && b.mandiOwnerId._id === user?.id) {
                            allBids.push({ ...b, harvestId: h._id });
                        }
                    });
                }
            } catch { /* skip */ }
        }
        setMyBids(allBids);
        setLoadingBids(false);
    }, [marketHarvests, user?.id]);

    useEffect(() => {
        if (activeTab === "mybids" && marketHarvests.length > 0) fetchMyBids();
    }, [activeTab, fetchMyBids, marketHarvests.length]);

    const handlePlaceBid = async (harvestId: string, currentHighest: number) => {
        const amountNum = Number(bidAmount);
        if (!amountNum || amountNum <= currentHighest) {
            setBidError(`Bid must be greater than Rs ${currentHighest}`);
            return;
        }
        if (!dropoffLocation.trim()) {
            setBidError("Please enter a drop-off location");
            return;
        }
        setSubmittingBid(true);
        setBidError("");
        try {
            const res = await fetch("/api/bids", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ harvestId, amount: amountNum, dropoffLocation })
            });
            if (res.ok) {
                setBiddingHarvestId(null);
                setBidAmount("");
                setDropoffLocation("");
                showToast("Bid placed successfully!");
                fetchMarket();
            } else {
                const data = await res.json();
                setBidError(data.message || "Failed to place bid");
            }
        } catch {
            setBidError("Network error occurred");
        } finally {
            setSubmittingBid(false);
        }
    };

    const uniqueGrades = useMemo(() =>
        [...new Set(marketHarvests.map(h => h.qualityGrade).filter(Boolean))].sort(),
        [marketHarvests]
    );

    const filteredHarvests = useMemo(() =>
        marketHarvests
            .filter(h => {
                if (gradeFilter && h.qualityGrade !== gradeFilter) return false;
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return h.cropType.toLowerCase().includes(q) || h.location.toLowerCase().includes(q) || h.farmerId?.name?.toLowerCase().includes(q);
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case "price_low": return a.basePrice - b.basePrice;
                    case "price_high": return b.basePrice - a.basePrice;
                    case "quantity": return b.quantity - a.quantity;
                    default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
            }),
        [marketHarvests, searchQuery, sortBy, gradeFilter]
    );

    const totalAvailable = marketHarvests.filter(h => h.status === "available").length;
    const totalBidding = marketHarvests.filter(h => h.status === "bidding").length;
    const totalMarketValue = useMemo(() =>
        marketHarvests.reduce((s, h) => s + h.basePrice * h.quantity, 0), [marketHarvests]);

    const filteredBids = useMemo(() =>
        bidFilter === "all" ? myBids : myBids.filter(b => b.status === bidFilter),
        [myBids, bidFilter]
    );
    const totalBidValue = useMemo(() =>
        myBids.filter(b => b.status === "accepted").reduce((s, b) => s + b.amount, 0),
        [myBids]
    );

    const tabs: { key: Tab; label: string; badge?: number }[] = [
        { key: "browse", label: "Browse Market", badge: marketHarvests.length },
        { key: "mybids", label: "My Bids", badge: myBids.length },
    ];

    return (
        <AppShell>
            {/* Toast notification */}
            {toast && (
                <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium
                    transition-all duration-300 animate-in slide-in-from-right
                    ${toast.type === "success" ? "bg-black dark:bg-white text-white dark:text-black" : "bg-red-600 text-white"}`}>
                    {toast.message}
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
                {/* Tabs */}
                <div className="flex gap-1 mb-6">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2
                                ${activeTab === t.key ? "bg-black dark:bg-white text-white dark:text-black shadow-sm" : "text-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>
                            {t.label}
                            {(t.badge ?? 0) > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                                    ${activeTab === t.key ? "bg-white/20" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"}`}>
                                    {t.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <AIOpsAssistant title="Mandi AI Assistant" subtitle="Ask about active bids, accepted bids, pricing opportunities, and order flow." />

                {/* BROWSE TAB */}
                {activeTab === "browse" && (
                    <div className="space-y-6">
                        {/* Header + stats */}
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-black dark:text-white">Market Dashboard</h1>
                                <p className="text-neutral-500 dark:text-neutral-400 mt-1">Browse available produce and place competitive bids.</p>
                            </div>
                            <div className="flex gap-3 text-center">
                                {[
                                    { value: totalAvailable, label: "Available", highlight: false },
                                    { value: totalBidding, label: "Bidding", highlight: true },
                                    { value: `Rs ${(totalMarketValue / 1000).toFixed(0)}k`, label: "Market Value", highlight: false },
                                ].map(s => (
                                    <div key={s.label} className={`px-5 py-3 rounded-2xl border transition-all duration-200 hover:scale-105
                                        ${s.highlight ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white" : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700"}`}>
                                        <div className={`text-xl font-bold ${s.highlight ? "text-white dark:text-black" : "text-black dark:text-white"}`}>{s.value}</div>
                                        <div className={`text-xs ${s.highlight ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-500 dark:text-neutral-400"}`}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Market Insights */}
                        {marketHarvests.length > 0 && (() => {
                            const cropCount: Record<string, { count: number; totalQty: number; avgPrice: number }> = {};
                            marketHarvests.forEach(h => {
                                if (!cropCount[h.cropType]) cropCount[h.cropType] = { count: 0, totalQty: 0, avgPrice: 0 };
                                cropCount[h.cropType].count++;
                                cropCount[h.cropType].totalQty += h.quantity;
                                cropCount[h.cropType].avgPrice += h.basePrice;
                            });
                            const topCrops = Object.entries(cropCount)
                                .map(([crop, d]) => ({ crop, count: d.count, qty: d.totalQty, avg: Math.round(d.avgPrice / d.count) }))
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 6);
                            const locations = new Set(marketHarvests.map(h => h.location));
                            const avgPrice = Math.round(marketHarvests.reduce((s, h) => s + h.basePrice, 0) / marketHarvests.length);
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 font-medium">Top Crops Available</div>
                                        <div className="flex flex-wrap gap-2">
                                            {topCrops.map(c => (
                                                <span key={c.crop} className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white">
                                                    {c.crop} <span className="text-neutral-400">({c.count})</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 font-medium">Market Overview</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-xl font-bold text-black dark:text-white tabular-nums">{locations.size}</div>
                                                <div className="text-[10px] text-neutral-400">Locations</div>
                                            </div>
                                            <div>
                                                <div className="text-xl font-bold text-black dark:text-white tabular-nums">Rs {avgPrice}</div>
                                                <div className="text-[10px] text-neutral-400">Avg Price/kg</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-black dark:bg-white rounded-2xl p-5 text-white dark:text-black">
                                        <div className="text-xs opacity-60 mb-2 font-medium">Total Supply</div>
                                        <div className="text-2xl font-bold tabular-nums">{marketHarvests.reduce((s, h) => s + h.quantity, 0).toLocaleString()} kg</div>
                                        <div className="text-xs opacity-50 mt-1">{marketHarvests.length} listings from {locations.size} locations</div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Search + sort + grade filter */}
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-3">
                                <div className="flex-1 min-w-[200px] relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <Input
                                        placeholder="Search by crop, location, or farmer..."
                                        value={searchQuery}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                        className="h-10 pl-10"
                                    />
                                </div>
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                    className="h-10 rounded-full border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 text-sm text-black dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors">
                                    <option value="newest">Newest First</option>
                                    <option value="price_low">Price: Low to High</option>
                                    <option value="price_high">Price: High to Low</option>
                                    <option value="quantity">Largest Quantity</option>
                                </select>
                                <Button variant="outline" className="rounded-full border-neutral-300 hover:bg-neutral-100 transition-all" onClick={fetchMarket}>
                                    Refresh
                                </Button>
                            </div>

                            {/* Grade filter chips */}
                            {uniqueGrades.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-400 font-medium">Grade:</span>
                                    <button onClick={() => setGradeFilter(null)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                                            ${!gradeFilter ? "bg-black text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}>
                                        All
                                    </button>
                                    {uniqueGrades.map(g => (
                                        <button key={g} onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                                                ${gradeFilter === g ? "bg-black text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}>
                                            Grade {g}
                                        </button>
                                    ))}
                                    {(searchQuery || gradeFilter) && (
                                        <span className="text-xs text-neutral-400 ml-1">
                                            {filteredHarvests.length} result{filteredHarvests.length !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {loading ? (
                            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 animate-pulse">
                                        <div className="flex justify-between mb-4">
                                            <div className="space-y-2">
                                                <div className="h-5 w-24 bg-neutral-200 dark:bg-neutral-700 rounded" />
                                                <div className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
                                            </div>
                                            <div className="h-7 w-20 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-800 rounded" />
                                            <div className="h-3 w-3/4 bg-neutral-100 dark:bg-neutral-800 rounded" />
                                            <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800 rounded" />
                                        </div>
                                        <div className="h-10 mt-6 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredHarvests.length === 0 ? (
                            <div className="bg-white dark:bg-neutral-900 p-16 rounded-2xl border border-neutral-200 dark:border-neutral-700 text-center">
                                <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <div className="text-neutral-400 text-lg font-medium mb-2">{searchQuery || gradeFilter ? "No results found" : "No harvests available"}</div>
                                <p className="text-neutral-500 text-sm">{searchQuery || gradeFilter ? "Try a different search or filter." : "Check back when farmers list their produce."}</p>
                                {(searchQuery || gradeFilter) && (
                                    <Button variant="outline" className="mt-4 rounded-full" onClick={() => { setSearchQuery(""); setGradeFilter(null); }}>
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                {filteredHarvests.map((harvest) => {
                                    const isExpanded = expandedCardId === harvest._id;
                                    const isBidding = biddingHarvestId === harvest._id;
                                    const bidMin = harvest.latestBid || harvest.basePrice;
                                    const bidPreview = Number(bidAmount);
                                    const totalCost = bidPreview > 0 ? bidPreview * harvest.quantity : 0;

                                    return (
                                        <div key={harvest._id}
                                            className={`bg-white dark:bg-neutral-900 rounded-2xl border transition-all duration-300 flex flex-col justify-between
                                                ${isBidding ? "border-black dark:border-white shadow-lg ring-1 ring-black/5 dark:ring-white/10" : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md"}`}>
                                            {/* Card header - always visible, clickable to expand */}
                                            <div className="p-6 pb-0">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold
                                                            ${gradeColors[harvest.qualityGrade] || "bg-neutral-100 text-neutral-500"}`}>
                                                            {harvest.qualityGrade || "?"}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-lg text-black dark:text-white leading-tight">{harvest.cropType}</h3>
                                                            <p className="text-xs text-neutral-400">{harvest.location}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <div className="text-right">
                                                            <div className="text-lg font-bold text-black dark:text-white">Rs {harvest.basePrice}</div>
                                                            <div className="text-[10px] text-neutral-400">per kg</div>
                                                        </div>
                                                        <FavoriteButton targetId={harvest._id} />
                                                    </div>
                                                </div>

                                                {/* Quick info row */}
                                                <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3">
                                                    <span>{harvest.quantity} kg</span>
                                                    <span className="w-0.5 h-0.5 bg-neutral-300 rounded-full" />
                                                    <span>{harvest.farmerId?.name || "Unknown"}</span>
                                                    {harvest.farmerTrust?.score !== undefined && (
                                                        <>
                                                            <span className="w-0.5 h-0.5 bg-neutral-300 rounded-full" />
                                                            <span className={`px-2 py-0.5 rounded-full font-medium ${trustClass(harvest.farmerTrust.score)}`}>
                                                                Trust {harvest.farmerTrust.score}
                                                            </span>
                                                        </>
                                                    )}
                                                    <span className="w-0.5 h-0.5 bg-neutral-300 rounded-full" />
                                                    <span>{timeAgo(harvest.createdAt)}</span>
                                                </div>

                                                {/* Bid bar visualization */}
                                                {harvest.latestBid && (
                                                    <div className="mb-3">
                                                        <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                                                            <span>Base: Rs {harvest.basePrice}</span>
                                                            <span>Bid: Rs {harvest.latestBid}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-black rounded-full transition-all duration-700"
                                                                style={{ width: `${Math.min((harvest.latestBid / (harvest.basePrice * 2)) * 100, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide
                                                        ${harvest.status === "available" ? "bg-neutral-100 text-neutral-600" : "bg-neutral-900 text-white"}`}>
                                                        {harvest.status.toUpperCase()}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-300">
                                                        Rs {(harvest.basePrice * harvest.quantity).toLocaleString()} total
                                                    </span>
                                                    <GovtPriceBadge harvestId={harvest._id} compact />
                                                </div>
                                            </div>

                                            {/* Expandable details */}
                                            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}>
                                                <div className="px-6 pb-1 space-y-2 text-sm">
                                                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                                                        <span>Quality Grade</span>
                                                        <span className="font-medium text-black dark:text-white">Grade {harvest.qualityGrade}</span>
                                                    </div>
                                                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                                                        <span>Total Value</span>
                                                        <span className="font-medium text-black dark:text-white">Rs {(harvest.basePrice * harvest.quantity).toLocaleString()}</span>
                                                    </div>
                                                    {harvest.farmerTrust?.score !== undefined && (
                                                        <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                                                            <span>Seller Trust Score</span>
                                                            <span className="font-medium text-black dark:text-white">
                                                                {harvest.farmerTrust.score}/100 ({harvest.farmerTrust.label})
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                                                        <span>Listed</span>
                                                        <span className="text-neutral-500 dark:text-neutral-400">{new Date(harvest.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    {harvest.latestBid && (
                                                        <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                                                            <span>Highest Bid</span>
                                                            <span className="font-bold text-black dark:text-white">Rs {harvest.latestBid}/kg</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bid form */}
                                            <div className="p-6 pt-0">
                                                {isBidding ? (
                                                    <div className="space-y-2.5 mt-3 pt-4 border-t border-neutral-100">
                                                        <Input type="number" placeholder={`Min Rs ${bidMin + 1}/kg`}
                                                            value={bidAmount}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBidAmount(e.target.value)}
                                                            className="h-10 rounded-xl" autoFocus />
                                                        <Input type="text" placeholder="Your drop-off location"
                                                            value={dropoffLocation}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDropoffLocation(e.target.value)}
                                                            className="h-10 rounded-xl" />
                                                        {totalCost > 0 && (
                                                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-2.5 flex justify-between text-sm">
                                                                <span className="text-neutral-500 dark:text-neutral-400">Total Cost ({harvest.quantity} kg)</span>
                                                                <span className="font-bold text-black dark:text-white">Rs {totalCost.toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        {/* AI Bid Advice */}
                                                        <button
                                                            onClick={() => fetchBidAdvice(harvest)}
                                                            disabled={aiLoading[harvest._id]}
                                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 text-sm text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                                            {aiLoading[harvest._id] ? (
                                                                <>
                                                                    <span className="w-3.5 h-3.5 border-2 border-neutral-300 dark:border-neutral-500 border-t-neutral-600 dark:border-t-neutral-200 rounded-full animate-spin" />
                                                                    Getting AI advice...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                                                    {aiAdvice[harvest._id] ? "Refresh AI Advice" : "Get AI Bid Suggestion"}
                                                                </>
                                                            )}
                                                        </button>
                                                        {aiAdvice[harvest._id] && (
                                                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-line">
                                                                {aiAdvice[harvest._id]}
                                                            </div>
                                                        )}
                                                        <Button className="w-full bg-black hover:bg-neutral-800 text-white rounded-full h-10 transition-all duration-200" disabled={submittingBid}
                                                            onClick={() => handlePlaceBid(harvest._id, bidMin)}>
                                                            {submittingBid ? (
                                                                <span className="flex items-center gap-2">
                                                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                    Submitting...
                                                                </span>
                                                            ) : "Submit Bid"}
                                                        </Button>
                                                        {bidError && <span className="text-red-600 text-xs block text-center">{bidError}</span>}
                                                        <button className="w-full text-sm text-neutral-400 hover:text-neutral-600 transition-colors py-1"
                                                            onClick={() => { setBiddingHarvestId(null); setBidError(""); setBidAmount(""); setDropoffLocation(""); }}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2 mt-3">
                                                        <Button className="flex-1 bg-black hover:bg-neutral-800 text-white rounded-full h-10 transition-all duration-200 hover:shadow-md"
                                                            onClick={() => { setBiddingHarvestId(harvest._id); setExpandedCardId(null); }}>
                                                            Place a Bid
                                                        </Button>
                                                        <button onClick={() => setExpandedCardId(isExpanded ? null : harvest._id)}
                                                            className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 flex items-center justify-center transition-all duration-200">
                                                            <svg className={`w-4 h-4 text-neutral-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                                                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* MY BIDS TAB */}
                {activeTab === "mybids" && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-black dark:text-white">My Bids</h1>
                                <p className="text-neutral-500 dark:text-neutral-400 mt-1">Track all bids you have placed across the marketplace.</p>
                            </div>
                            {myBids.length > 0 && totalBidValue > 0 && (
                                <div className="bg-black text-white px-5 py-3 rounded-2xl">
                                    <div className="text-xl font-bold">Rs {totalBidValue.toLocaleString()}</div>
                                    <div className="text-xs text-neutral-300">Accepted Value</div>
                                </div>
                            )}
                        </div>

                        {loadingBids ? (
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 animate-pulse flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 w-32 bg-neutral-200 rounded" />
                                            <div className="h-3 w-48 bg-neutral-100 rounded" />
                                        </div>
                                        <div className="h-6 w-20 bg-neutral-100 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : myBids.length === 0 ? (
                            <div className="bg-white dark:bg-neutral-900 p-16 rounded-2xl border border-neutral-200 dark:border-neutral-700 text-center">
                                <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="text-neutral-400 text-lg font-medium mb-2">No bids placed yet</div>
                                <p className="text-neutral-500 text-sm mb-4">Browse the market and place your first bid.</p>
                                <Button onClick={() => setActiveTab("browse")} className="bg-black text-white rounded-full hover:bg-neutral-800 transition-all">
                                    Browse Market
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Summary + filter */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {(["all", "pending", "accepted", "rejected"] as const).map(f => {
                                        const count = f === "all" ? myBids.length : myBids.filter(b => b.status === f).length;
                                        return (
                                            <button key={f} onClick={() => setBidFilter(f)}
                                                className={`p-4 rounded-2xl border text-center transition-all duration-200
                                                    ${bidFilter === f
                                                        ? "bg-black text-white border-black shadow-sm"
                                                        : "bg-white border-neutral-200 hover:border-neutral-300"}`}>
                                                <div className={`text-xl font-bold ${bidFilter === f ? "text-white" : "text-black"}`}>{count}</div>
                                                <div className={`text-xs capitalize ${bidFilter === f ? "text-neutral-300" : "text-neutral-500"}`}>{f}</div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Bid list */}
                                <div className="space-y-2">
                                    {filteredBids.map(bid => {
                                        const harvest = marketHarvests.find(h => h._id === bid.harvestId);
                                        return (
                                            <div key={bid._id}
                                                className="bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 transition-all duration-200 hover:shadow-sm overflow-hidden">
                                                <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200
                                                            ${bid.status === "accepted" ? "bg-black text-white" :
                                                            bid.status === "pending" ? "bg-neutral-200 text-neutral-700" :
                                                            "bg-neutral-100 text-neutral-400"}`}>
                                                            {harvest?.cropType?.charAt(0).toUpperCase() || "?"}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-black">{harvest?.cropType || "Harvest"}</div>
                                                            <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                                                                <span>{harvest?.location}</span>
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                                </svg>
                                                                <span>{bid.dropoffLocation}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className="text-lg font-bold text-black">Rs {bid.amount}/kg</div>
                                                            <div className="text-[10px] text-neutral-400">{timeAgo(bid.createdAt)}</div>
                                                        </div>
                                                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium tracking-wide
                                                            ${bid.status === "pending" ? "bg-neutral-100 text-neutral-600" :
                                                            bid.status === "accepted" ? "bg-black text-white" :
                                                            "bg-neutral-100 text-neutral-400 line-through"}`}>
                                                            {bid.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Progress bar at bottom of card */}
                                                <div className={`h-0.5 transition-all duration-500
                                                    ${bid.status === "accepted" ? "bg-black" :
                                                    bid.status === "pending" ? "bg-neutral-300" : "bg-neutral-100"}`} />
                                            </div>
                                        );
                                    })}
                                </div>

                                {filteredBids.length === 0 && (
                                    <div className="text-center py-12 text-neutral-400 text-sm">
                                        No {bidFilter} bids found.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
