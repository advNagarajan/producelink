"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "next-auth/react";

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

export default function FarmerDashboard() {
    const [harvests, setHarvests] = useState<Harvest[]>([]);
    const [bidsMap, setBidsMap] = useState<Record<string, Bid[]>>({});
    const [loading, setLoading] = useState(true);
    const [expandedHarvest, setExpandedHarvest] = useState<string | null>(null);
    const [accepting, setAccepting] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        cropType: "", quantity: "", qualityGrade: "A", basePrice: "", location: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [insight, setInsight] = useState("");
    const [loadingInsight, setLoadingInsight] = useState(false);

    const fetchHarvests = useCallback(async () => {
        try {
            const res = await fetch("/api/harvests");
            if (res.ok) setHarvests(await res.json());
        } catch (err) {
            console.error("Failed to fetch harvests", err);
        } finally {
            setLoading(false);
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
    }, [fetchHarvests]);

    // Poll bids every 5s for harvests that are in bidding state
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
                fetchHarvests();
            } else {
                const data = await res.json();
                setFormError(data.message || "Failed to list harvest");
            }
        } catch (err) {
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
                fetchHarvests();
                // refresh bids 
                setBidsMap({});
            }
        } catch (err) {
            console.error("Failed to accept bid", err);
        } finally {
            setAccepting(null);
        }
    };

    const totalHarvests = harvests.length;
    const activeBidding = harvests.filter((h) => h.status === "bidding").length;
    const sold = harvests.filter((h) => h.status === "sold").length;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Top bar */}
            <header className="bg-white dark:bg-slate-900 border-b px-8 h-16 flex items-center justify-between">
                <span className="font-bold text-xl text-green-600">🌾 ProduceLink</span>
                <div className="flex items-center gap-6">
                    <div className="flex gap-4 text-center">
                        <div><div className="text-xl font-bold">{totalHarvests}</div><div className="text-xs text-slate-500">Listings</div></div>
                        <div><div className="text-xl font-bold text-blue-600">{activeBidding}</div><div className="text-xs text-slate-500">Bidding</div></div>
                        <div><div className="text-xl font-bold text-green-600">{sold}</div><div className="text-xs text-slate-500">Sold</div></div>
                    </div>
                    <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>Sign Out</Button>
                </div>
            </header>

            <div className="p-8 grid gap-8 lg:grid-cols-3">
                {/* ── List New Harvest Form ── */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border h-fit lg:col-span-1">
                    <h2 className="text-xl font-bold mb-4">List New Harvest</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="cropType">Crop Type</Label>
                            <Input id="cropType" required placeholder="e.g., Wheat, Tomatoes"
                                value={formData.cropType} onChange={(e) => setFormData({ ...formData, cropType: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="location">Location</Label>
                            <Input id="location" required placeholder="City, State"
                                value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="quantity">Quantity (kg)</Label>
                            <Input id="quantity" type="number" min="1" required
                                value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="qualityGrade">Quality Grade</Label>
                            <select id="qualityGrade"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={formData.qualityGrade}
                                onChange={(e) => setFormData({ ...formData, qualityGrade: e.target.value })}>
                                <option value="A">Grade A (Premium)</option>
                                <option value="B">Grade B (Standard)</option>
                                <option value="C">Grade C (Fair)</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="basePrice">Base Price (₹/kg)</Label>
                            <div className="flex gap-2">
                                <Input id="basePrice" type="number" min="1" required
                                    value={formData.basePrice} onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })} />
                                <Button type="button" variant="secondary" onClick={handleGetInsight}
                                    disabled={loadingInsight || !formData.cropType || !formData.location}>
                                    {loadingInsight ? "…" : "AI Hint"}
                                </Button>
                            </div>
                        </div>
                        {insight && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                                <span className="font-semibold block mb-1">🤖 Market Insight:</span>{insight}
                            </div>
                        )}
                        {formError && <div className="text-red-500 text-sm">{formError}</div>}
                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={submitting}>
                            {submitting ? "Listing…" : "List Harvest"}
                        </Button>
                    </form>
                </div>

                {/* ── Harvest Listings ── */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold">Your Listings</h2>

                    {loading ? (
                        <p className="text-slate-500">Loading…</p>
                    ) : harvests.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border text-center text-slate-500">
                            No harvests yet. List your first one!
                        </div>
                    ) : (
                        harvests.map((harvest) => {
                            const bids = bidsMap[harvest._id] || [];
                            const highestBid = bids[0]; // sorted by amount desc
                            const isExpanded = expandedHarvest === harvest._id;

                            return (
                                <div key={harvest._id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                    {/* Harvest summary row */}
                                    <div className="p-5 flex flex-wrap items-center gap-4 justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-lg text-green-700 dark:text-green-400">{harvest.cropType}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${harvest.status === "available" ? "bg-blue-100 text-blue-700" :
                                                        harvest.status === "bidding" ? "bg-orange-100 text-orange-700" :
                                                            "bg-gray-100 text-gray-600"
                                                    }`}>{harvest.status.toUpperCase()}</span>
                                            </div>
                                            <p className="text-sm text-slate-500">{harvest.location} · {harvest.quantity} kg · Grade {harvest.qualityGrade} · ₹{harvest.basePrice}/kg</p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {highestBid && harvest.status !== "sold" && (
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-400">Highest Bid</div>
                                                    <div className="font-bold text-green-600 text-lg">₹{highestBid.amount}</div>
                                                </div>
                                            )}
                                            {harvest.status !== "sold" && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setExpandedHarvest(isExpanded ? null : harvest._id)}
                                                >
                                                    {isExpanded ? "Hide Bids" : `View Bids (${bids.length})`}
                                                </Button>
                                            )}
                                            {harvest.status === "sold" && (
                                                <span className="text-sm text-green-600 font-semibold">✓ Sold — delivery request created</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bids panel */}
                                    {isExpanded && (
                                        <div className="border-t px-5 pb-5 pt-4 space-y-3">
                                            <h4 className="font-semibold text-sm text-slate-600">Incoming Bids {bids.length === 0 && "(none yet — refreshing every 5s)"}</h4>
                                            {bids.map((bid) => (
                                                <div key={bid._id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
                                                    <div>
                                                        <div className="font-medium">{bid.mandiOwnerId?.name || "Mandi Owner"}</div>
                                                        <div className="text-xs text-slate-400">{bid.mandiOwnerId?.email}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="font-bold text-green-600 text-lg">₹{bid.amount}</div>
                                                            <div className="text-xs text-slate-400">{new Date(bid.createdAt).toLocaleTimeString()}</div>
                                                        </div>
                                                        {bid.status === "pending" && (
                                                            <Button
                                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                                onClick={() => handleAcceptBid(bid._id)}
                                                                disabled={accepting === bid._id}
                                                            >
                                                                {accepting === bid._id ? "Accepting…" : "Accept Bid"}
                                                            </Button>
                                                        )}
                                                        {bid.status === "accepted" && (
                                                            <span className="text-green-600 font-semibold text-sm">✓ Accepted</span>
                                                        )}
                                                        {bid.status === "rejected" && (
                                                            <span className="text-slate-400 text-sm">Rejected</span>
                                                        )}
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
            </div>
        </div>
    );
}
