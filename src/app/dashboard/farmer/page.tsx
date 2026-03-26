"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";
import StarRating from "@/components/StarRating";
import Link from "next/link";

// Optimized: Lazy load heavy components
const WeatherWidget = dynamic(() => import("@/components/WeatherWidget"), {
    loading: () => <div className="h-20 animate-pulse bg-neutral-100 dark:bg-neutral-800 rounded-xl" />,
    ssr: false,
});

const BulkHarvestForm = dynamic(() => import("@/components/BulkHarvestForm"), {
    loading: () => <div className="h-40 animate-pulse bg-neutral-100 dark:bg-neutral-800 rounded-xl" />,
    ssr: false,
});

const GovtPriceBadge = dynamic(() => import("@/components/GovtPriceBadge"), { ssr: false });
const MLPricePredictor = dynamic(() => import("@/components/MLPricePredictor"), { ssr: false });

interface Bid {
    _id: string;
    mandiOwnerId: { _id: string; name: string; email: string };
    amount: number;
    status: "pending" | "accepted" | "rejected";
    createdAt: string;
}

interface Harvest {
    _id: string;
    cropType: string;
    quantity: number;
    qualityGrade: string;
    basePrice: number;
    location: string;
    status: "available" | "bidding" | "sold";
    createdAt: string;
}

interface DeliveryRequest {
    _id: string;
    harvestId: { _id: string; cropType: string; quantity: number; location: string };
    pickupLocation: string;
    dropoffLocation: string;
    status: "pending" | "accepted" | "in_transit" | "delivered";
    transporterId?: { _id: string; name: string };
    createdAt: string;
}

type Tab = "overview" | "listings" | "deliveries" | "bulk";

export default function FarmerDashboard() {
    const { user } = useAuth();
    const [harvests, setHarvests] = useState<Harvest[]>([]);
    const [bidsMap, setBidsMap] = useState<Record<string, Bid[]>>({});
    const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedHarvest, setExpandedHarvest] = useState<string | null>(null);
    const [accepting, setAccepting] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const [formData, setFormData] = useState({
        cropType: "", quantity: "", qualityGrade: "A", basePrice: "", location: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [formSuccess, setFormSuccess] = useState("");
    const [insight, setInsight] = useState("");
    const [loadingInsight, setLoadingInsight] = useState(false);
    const [ratingSubmitted, setRatingSubmitted] = useState<Record<string, boolean>>({});

    const fetchHarvests = useCallback(async () => {
        try {
            const res = await fetch("/api/harvests");
            if (res.ok) {
                const data = await res.json();
                setHarvests(Array.isArray(data) ? data : data.items || []);
            }
        } catch (err) {
            console.error("Failed to fetch harvests", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDeliveries = useCallback(async () => {
        try {
            const res = await fetch("/api/delivery-requests");
            if (res.ok) setDeliveries(await res.json());
        } catch (err) {
            console.error("Failed to fetch deliveries", err);
        }
    }, []);

    const fetchBidsForHarvest = useCallback(async (harvestId: string) => {
        try {
            const res = await fetch(`/api/bids?harvestId=${harvestId}`);
            if (res.ok) {
                const bids = await res.json();
                setBidsMap((prev) => ({ ...prev, [harvestId]: bids }));
            }
        } catch (err) {
            console.error("Failed to fetch bids", err);
        }
    }, []);

    useEffect(() => {
        fetchHarvests();
        fetchDeliveries();
    }, [fetchHarvests, fetchDeliveries]);

    useEffect(() => {
        const biddingHarvests = harvests.filter((h) => h.status === "bidding" || h.status === "available");
        biddingHarvests.forEach((h) => fetchBidsForHarvest(h._id));
        const interval = setInterval(() => {
            biddingHarvests.forEach((h) => fetchBidsForHarvest(h._id));
        }, 5000);
        return () => clearInterval(interval);
    }, [harvests, fetchBidsForHarvest]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError("");
        setFormSuccess("");
        try {
            const res = await fetch("/api/harvests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    quantity: Number(formData.quantity),
                    basePrice: Number(formData.basePrice),
                }),
            });
            if (res.ok) {
                setFormData({ cropType: "", quantity: "", qualityGrade: "A", basePrice: "", location: "" });
                setInsight("");
                setFormSuccess("Harvest listed successfully.");
                fetchHarvests();
                setTimeout(() => setFormSuccess(""), 3000);
            } else {
                const data = await res.json();
                setFormError(data.message || "Failed to list harvest");
            }
        } catch {
            setFormError("Unexpected error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleGetInsight = async () => {
        if (!formData.cropType || !formData.location) {
            setFormError("Enter a crop type and location first.");
            return;
        }
        setLoadingInsight(true);
        setFormError("");
        try {
            const res = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cropType: formData.cropType, location: formData.location }),
            });
            const data = await res.json();
            if (res.ok) setInsight(data.prediction);
            else setFormError(data.message || "Prediction failed");
        } catch {
            setFormError("Could not reach prediction service");
        } finally {
            setLoadingInsight(false);
        }
    };

    const handleAcceptBid = async (bidId: string) => {
        setAccepting(bidId);
        try {
            const res = await fetch(`/api/bids/${bidId}/accept`, { method: "POST" });
            if (res.ok) {
                setHarvests((prev) => prev.map(harvest => {
                    const bids = bidsMap[harvest._id] || [];
                    if (bids.some(b => b._id === bidId)) return { ...harvest, status: "sold" };
                    return harvest;
                }));
                setBidsMap(prev => {
                    const newMap = { ...prev };
                    for (const hid in newMap) {
                        if (newMap[hid].some(b => b._id === bidId)) {
                            newMap[hid] = newMap[hid].map(b =>
                                b._id === bidId ? { ...b, status: "accepted" } : { ...b, status: "rejected" }
                            );
                        }
                    }
                    return newMap;
                });
                fetchDeliveries();
            }
        } catch (err) {
            console.error("Failed to accept bid", err);
        } finally {
            setAccepting(null);
        }
    };

    // Stats
    const totalHarvests = harvests.length;

    const handleRateTransporter = async (transporterId: string, score: number) => {
        try {
            await fetch("/api/ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toUser: transporterId, score, comment: "" }),
            });
            setRatingSubmitted((prev) => ({ ...prev, [transporterId]: true }));
        } catch { /* ignore */ }
    };
    const activeBidding = harvests.filter((h) => h.status === "bidding").length;
    const sold = harvests.filter((h) => h.status === "sold").length;
    const available = harvests.filter((h) => h.status === "available").length;
    const totalBids = Object.values(bidsMap).reduce((sum, bids) => sum + bids.length, 0);
    const totalRevenue = useMemo(() => {
        let rev = 0;
        harvests.filter(h => h.status === "sold").forEach(h => {
            const bids = bidsMap[h._id] || [];
            const accepted = bids.find(b => b.status === "accepted");
            if (accepted) rev += accepted.amount * h.quantity;
        });
        return rev;
    }, [harvests, bidsMap]);
    const deliveriesInTransit = deliveries.filter(d => d.status === "in_transit").length;
    const deliveriesDelivered = deliveries.filter(d => d.status === "delivered").length;

    const filteredHarvests = filterStatus === "all" ? harvests : harvests.filter(h => h.status === filterStatus);

    const tabs: { key: Tab; label: string }[] = [
        { key: "overview", label: "Overview" },
        { key: "listings", label: "My Listings" },
        { key: "deliveries", label: "Deliveries" },
        { key: "bulk", label: "Bulk List" },
    ];

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto p-6 md:p-8">
                {/* Tabs */}
                <div className="flex gap-1 mb-6 overflow-x-auto">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.key ? "bg-black dark:bg-white text-white dark:text-black" : "text-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                    <div className="space-y-8">
                        {/* Welcome */}
                        <div>
                            <h1 className="text-3xl font-bold text-black dark:text-white">Welcome back, {user?.name?.split(" ")[0]}</h1>
                            <p className="text-neutral-500 mt-1">Here is a summary of your farm activity.</p>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Total Listings", value: totalHarvests },
                                { label: "Active Bidding", value: activeBidding },
                                { label: "Sold", value: sold },
                                { label: "Total Bids Received", value: totalBids },
                            ].map(s => (
                                <div key={s.label} className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                                    <div className="text-2xl font-bold text-black dark:text-white">{s.value}</div>
                                    <div className="text-sm text-neutral-500 mt-1">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Revenue + Weather */}
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6">
                                <h3 className="text-sm font-medium text-neutral-500 mb-1">Estimated Revenue</h3>
                                <div className="text-3xl font-bold text-black dark:text-white">
                                    {totalRevenue > 0 ? `Rs ${totalRevenue.toLocaleString()}` : "No sales yet"}
                                </div>
                                <p className="text-xs text-neutral-400 mt-2">Based on accepted bid amounts multiplied by quantity</p>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6">
                                <h3 className="text-sm font-medium text-neutral-500 mb-3">Delivery Status</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">Awaiting Pickup</span>
                                        <span className="font-semibold text-black dark:text-white">{deliveries.filter(d => d.status === "pending" || d.status === "accepted").length}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">In Transit</span>
                                        <span className="font-semibold text-black dark:text-white">{deliveriesInTransit}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">Delivered</span>
                                        <span className="font-semibold text-black dark:text-white">{deliveriesDelivered}</span>
                                    </div>
                                </div>
                            </div>
                            <WeatherWidget location={harvests[0]?.location || "Delhi"} />
                        </div>

                        {/* Quick actions + recent */}
                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* List New Harvest Form */}
                            <div className="bg-white p-6 rounded-2xl border border-neutral-200 h-fit lg:col-span-1">
                                <h2 className="text-lg font-bold text-black mb-5">List New Harvest</h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="cropType">Crop Type</Label>
                                        <Input id="cropType" required placeholder="e.g., Wheat, Tomatoes"
                                            value={formData.cropType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, cropType: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="location">Location</Label>
                                        <Input id="location" required placeholder="City, State"
                                            value={formData.location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, location: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="quantity">Quantity (kg)</Label>
                                            <Input id="quantity" type="number" min="1" required
                                                value={formData.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, quantity: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="qualityGrade">Grade</Label>
                                            <select id="qualityGrade"
                                                className="flex h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black focus:ring-1 focus:ring-black"
                                                value={formData.qualityGrade}
                                                onChange={(e) => setFormData({ ...formData, qualityGrade: e.target.value })}>
                                                <option value="A">A (Premium)</option>
                                                <option value="B">B (Standard)</option>
                                                <option value="C">C (Fair)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="basePrice">Base Price (Rs/kg)</Label>
                                        <div className="flex gap-2">
                                            <Input id="basePrice" type="number" min="1" required
                                                value={formData.basePrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, basePrice: e.target.value })} />
                                            <Button type="button" variant="outline" className="rounded-full border-neutral-300 text-black shrink-0 text-xs px-3" onClick={handleGetInsight}
                                                disabled={loadingInsight || !formData.cropType || !formData.location}>
                                                {loadingInsight ? "..." : "AI Price Hint"}
                                            </Button>
                                        </div>
                                    </div>
                                    {insight && (
                                        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700">
                                            <span className="font-semibold block mb-1">Market Insight</span>{insight}
                                        </div>
                                    )}
                                    {formData.cropType && formData.location && (
                                        <MLPricePredictor
                                            cropType={formData.cropType}
                                            location={formData.location}
                                            quantity={Number(formData.quantity) || 100}
                                            qualityGrade={formData.qualityGrade}
                                            onPriceSelect={(price) => setFormData(prev => ({ ...prev, basePrice: String(price) }))}
                                        />
                                    )}
                                    {formError && <div className="text-red-600 text-sm">{formError}</div>}
                                    {formSuccess && <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg p-2">{formSuccess}</div>}
                                    <Button type="submit" className="w-full bg-black hover:bg-neutral-800 text-white h-11 rounded-full" disabled={submitting}>
                                        {submitting ? "Listing..." : "List Harvest"}
                                    </Button>
                                </form>
                            </div>

                            {/* Recent activity */}
                            <div className="lg:col-span-2 space-y-4">
                                <h2 className="text-lg font-bold text-black">Recent Activity</h2>
                                {harvests.length === 0 ? (
                                    <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center">
                                        <div className="text-neutral-400 text-lg font-medium mb-2">No listings yet</div>
                                        <p className="text-neutral-500 text-sm">List your first harvest using the form to start receiving bids from mandi owners.</p>
                                    </div>
                                ) : (
                                    harvests.slice(0, 5).map((harvest) => {
                                        const bids = bidsMap[harvest._id] || [];
                                        const highestBid = bids.length > 0 ? bids[0] : null;
                                        return (
                                            <div key={harvest._id} className="bg-white rounded-2xl border border-neutral-200 p-5 flex flex-wrap items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                                        harvest.status === "sold" ? "bg-black text-white" :
                                                        harvest.status === "bidding" ? "bg-neutral-900 text-white" :
                                                        "bg-neutral-100 text-neutral-600"
                                                    }`}>
                                                        {harvest.cropType.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-black">{harvest.cropType}</div>
                                                        <div className="text-xs text-neutral-500">{harvest.quantity} kg at {harvest.location} -- Grade {harvest.qualityGrade}</div>
                                                        <GovtPriceBadge harvestId={harvest._id} compact />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {highestBid && (
                                                        <div className="text-right">
                                                            <div className="text-xs text-neutral-400">Top Bid</div>
                                                            <div className="font-bold text-black">Rs {highestBid.amount}/kg</div>
                                                        </div>
                                                    )}
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        harvest.status === "available" ? "bg-neutral-100 text-neutral-600" :
                                                        harvest.status === "bidding" ? "bg-neutral-900 text-white" :
                                                        "bg-neutral-100 text-neutral-400"
                                                    }`}>{harvest.status.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                {harvests.length > 5 && (
                                    <button onClick={() => setActiveTab("listings")} className="text-sm text-neutral-500 hover:text-black font-medium">
                                        View all {harvests.length} listings
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* LISTINGS TAB */}
                {activeTab === "listings" && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-black">My Listings</h1>
                                <p className="text-neutral-500 mt-1">{harvests.length} total harvests listed</p>
                            </div>
                            <div className="flex gap-2">
                                {["all", "available", "bidding", "sold"].map(s => (
                                    <button key={s} onClick={() => setFilterStatus(s)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                            filterStatus === s
                                                ? "bg-black text-white border-black"
                                                : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                                        }`}>
                                        {s === "all" ? `All (${harvests.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${harvests.filter(h => h.status === s).length})`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-black" /></div>
                        ) : filteredHarvests.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center text-neutral-500">
                                {filterStatus === "all" ? "No harvests yet. Go to Overview to list one." : `No ${filterStatus} harvests.`}
                            </div>
                        ) : (
                            filteredHarvests.map((harvest) => {
                                const bids = bidsMap[harvest._id] || [];
                                const highestBid = bids[0];
                                const isExpanded = expandedHarvest === harvest._id;

                                return (
                                    <div key={harvest._id} className="bg-white rounded-2xl border border-neutral-200">
                                        <div className="p-5 flex flex-wrap items-center gap-4 justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                                                    harvest.status === "sold" ? "bg-black text-white" :
                                                    harvest.status === "bidding" ? "bg-neutral-900 text-white" :
                                                    "bg-neutral-100 text-neutral-600"
                                                }`}>
                                                    {harvest.cropType.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-lg text-black">{harvest.cropType}</h3>
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                            harvest.status === "available" ? "bg-neutral-100 text-neutral-600" :
                                                            harvest.status === "bidding" ? "bg-neutral-900 text-white" :
                                                            "bg-neutral-100 text-neutral-400"
                                                        }`}>{harvest.status.toUpperCase()}</span>
                                                    </div>
                                                    <p className="text-sm text-neutral-500 mt-0.5">
                                                        {harvest.location} -- {harvest.quantity} kg -- Grade {harvest.qualityGrade} -- Base: Rs {harvest.basePrice}/kg -- Listed {new Date(harvest.createdAt).toLocaleDateString()}
                                                    </p>
                                                    <GovtPriceBadge harvestId={harvest._id} />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {highestBid && harvest.status !== "sold" && (
                                                    <div className="text-right">
                                                        <div className="text-xs text-neutral-400">Highest Bid</div>
                                                        <div className="font-bold text-black text-lg">Rs {highestBid.amount}</div>
                                                    </div>
                                                )}
                                                {harvest.status !== "sold" && (
                                                    <Button variant="outline" className="rounded-full border-neutral-300 text-black"
                                                        onClick={() => setExpandedHarvest(isExpanded ? null : harvest._id)}>
                                                        {isExpanded ? "Hide Bids" : `Bids (${bids.length})`}
                                                    </Button>
                                                )}
                                                {harvest.status === "sold" && (
                                                    <span className="text-sm text-neutral-500 font-medium">Sold -- delivery created</span>
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-neutral-200 px-5 pb-5 pt-4 space-y-3">
                                                <h4 className="font-medium text-sm text-neutral-500">
                                                    Incoming Bids {bids.length === 0 && "(none yet -- auto-refreshing)"}
                                                </h4>
                                                {bids.map((bid) => (
                                                    <div key={bid._id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3">
                                                        <div>
                                                            <div className="font-medium text-black">{bid.mandiOwnerId?.name || "Mandi Owner"}</div>
                                                            <div className="text-xs text-neutral-400">{bid.mandiOwnerId?.email}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <div className="font-bold text-black text-lg">Rs {bid.amount}</div>
                                                                <div className="text-xs text-neutral-400">{new Date(bid.createdAt).toLocaleString()}</div>
                                                            </div>
                                                            {bid.status === "pending" && (
                                                                <Button className="bg-black hover:bg-neutral-800 text-white rounded-full"
                                                                    onClick={() => handleAcceptBid(bid._id)} disabled={accepting === bid._id}>
                                                                    {accepting === bid._id ? "Accepting..." : "Accept"}
                                                                </Button>
                                                            )}
                                                            {bid.status === "accepted" && <span className="text-black font-medium text-sm">Accepted</span>}
                                                            {bid.status === "rejected" && <span className="text-neutral-400 text-sm">Rejected</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* DELIVERIES TAB */}
                {activeTab === "deliveries" && (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-black">Delivery Tracking</h1>
                            <p className="text-neutral-500 mt-1">Track the status of your sold harvests.</p>
                        </div>

                        {deliveries.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center text-neutral-500">
                                No delivery requests yet. Once you accept a bid, a delivery request is created automatically.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {deliveries.map(d => {
                                    const steps = ["pending", "accepted", "in_transit", "delivered"];
                                    const currentIndex = steps.indexOf(d.status);
                                    return (
                                        <div key={d._id} className="bg-white rounded-2xl border border-neutral-200 p-6">
                                            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <h3 className="font-semibold text-lg text-black">{d.harvestId?.cropType || "Produce"}</h3>
                                                    <p className="text-sm text-neutral-500">{d.harvestId?.quantity} kg</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                    d.status === "delivered" ? "bg-black text-white" :
                                                    d.status === "in_transit" ? "bg-neutral-800 text-white" :
                                                    "bg-neutral-100 text-neutral-600"
                                                }`}>
                                                    {d.status.replace("_", " ").toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="grid sm:grid-cols-2 gap-4 text-sm mb-5">
                                                <div className="bg-neutral-50 rounded-lg p-3">
                                                    <div className="text-xs text-neutral-400 mb-1">Pickup</div>
                                                    <div className="text-black font-medium">{d.pickupLocation}</div>
                                                </div>
                                                <div className="bg-neutral-50 rounded-lg p-3">
                                                    <div className="text-xs text-neutral-400 mb-1">Drop-off</div>
                                                    <div className="text-black font-medium">{d.dropoffLocation}</div>
                                                </div>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="flex items-center gap-1">
                                                {steps.map((step, i) => (
                                                    <div key={step} className="flex-1 flex items-center gap-1">
                                                        <div className={`h-1.5 w-full rounded-full ${i <= currentIndex ? "bg-black" : "bg-neutral-200"}`} />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between mt-2 text-xs text-neutral-400">
                                                <span>Pending</span>
                                                <span>Accepted</span>
                                                <span>In Transit</span>
                                                <span>Delivered</span>
                                            </div>
                                            {d.transporterId && (
                                                <div className="mt-4 text-sm text-neutral-500">
                                                    Transporter: <Link href={`/profile/${d.transporterId._id}`} className="font-medium text-black dark:text-white hover:underline">{d.transporterId.name}</Link>
                                                </div>
                                            )}
                                            {d.status === "delivered" && (
                                                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-4">
                                                    {d.transporterId && !ratingSubmitted[d.transporterId._id] && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-neutral-400">Rate transporter:</span>
                                                            <StarRating value={0} size="sm" onChange={(score) => handleRateTransporter(d.transporterId!._id, score)} />
                                                        </div>
                                                    )}
                                                    {d.transporterId && ratingSubmitted[d.transporterId._id] && (
                                                        <span className="text-xs text-neutral-400">Rating submitted</span>
                                                    )}
                                                    <Link href={`/invoice/${d._id}`}
                                                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                                                        View Invoice
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* BULK LIST TAB */}
                {activeTab === "bulk" && (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-black dark:text-white">Bulk Harvest Listing</h1>
                            <p className="text-neutral-500 mt-1">List multiple harvests at once.</p>
                        </div>
                        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6">
                            <BulkHarvestForm onSuccess={fetchHarvests} />
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
