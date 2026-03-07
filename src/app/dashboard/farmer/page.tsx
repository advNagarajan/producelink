"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "next-auth/react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

interface Harvest {
    _id: string;
    cropType: string;
    quantity: number;
    qualityGrade: string;
    basePrice: number;
    location: string;
    status: string;
    createdAt: string;
    latestBid?: number;
}

export default function FarmerDashboard() {
    const [harvests, setHarvests] = useState<Harvest[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        cropType: "",
        quantity: "",
        qualityGrade: "A",
        basePrice: "",
        location: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [insight, setInsight] = useState("");
    const [loadingInsight, setLoadingInsight] = useState(false);

    const fetchHarvests = async () => {
        try {
            const res = await fetch("/api/harvests");
            if (res.ok) {
                const data = await res.json();
                setHarvests(data);
            }
        } catch (err) {
            console.error("Failed to fetch harvests", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHarvests();

        // Set up Firebase listener for all latest bids
        const latestBidsRef = ref(database, "latestBids");
        const unsubscribe = onValue(latestBidsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setHarvests((currentHarvests) =>
                    currentHarvests.map(harvest => {
                        if (data[harvest._id]) {
                            return { ...harvest, latestBid: data[harvest._id].amount };
                        }
                        return harvest;
                    })
                );
            }
        });

        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

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
                setFormData({
                    cropType: "",
                    quantity: "",
                    qualityGrade: "A",
                    basePrice: "",
                    location: "",
                });
                fetchHarvests();
            } else {
                const data = await res.json();
                setError(data.message || "Failed to add harvest");
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const handleGetInsight = async () => {
        if (!formData.cropType || !formData.location) {
            setError("Please enter a Crop Type and Location to get insights.");
            return;
        }

        setLoadingInsight(true);
        setError("");
        setInsight(""); // Clear previous insight

        try {
            const res = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cropType: formData.cropType,
                    location: formData.location
                })
            });

            const data = await res.json();
            if (res.ok) {
                setInsight(data.prediction);
            } else {
                setError(data.message || "Failed to fetch insights");
            }
        } catch (err) {
            setError("Error connecting to prediction service");
        } finally {
            setLoadingInsight(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        Farmer Dashboard
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">
                        Manage your harvests and view live bids.
                    </p>
                </div>
                <Button variant="outline" onClick={() => signOut()}>
                    Sign Out
                </Button>
            </header>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Add New Harvest Form */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 lg:col-span-1 h-fit">
                    <h2 className="text-xl font-bold mb-4">List New Harvest</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cropType">Crop Type</Label>
                            <Input
                                id="cropType"
                                required
                                placeholder="e.g., Wheat, Tomatoes"
                                value={formData.cropType}
                                onChange={(e) => setFormData({ ...formData, cropType: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity (kg)</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                required
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="qualityGrade">Quality Grade</Label>
                            <select
                                id="qualityGrade"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.qualityGrade}
                                onChange={(e) => setFormData({ ...formData, qualityGrade: e.target.value })}
                            >
                                <option value="A">Grade A (Premium)</option>
                                <option value="B">Grade B (Standard)</option>
                                <option value="C">Grade C (Fair)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="basePrice">Base Price (₹ per kg)</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="basePrice"
                                    type="number"
                                    min="1"
                                    required
                                    value={formData.basePrice}
                                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleGetInsight}
                                    disabled={loadingInsight || !formData.cropType || !formData.location}
                                >
                                    {loadingInsight ? "Analyzing..." : "AI Pricing Insight"}
                                </Button>
                            </div>
                        </div>

                        {insight && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                                <span className="font-semibold block mb-1">🤖 Market Trend Prediction:</span>
                                {insight}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                required
                                placeholder="City, State"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>

                        {error && <div className="text-red-500 text-sm">{error}</div>}

                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={submitting}>
                            {submitting ? "Listing..." : "List Harvest"}
                        </Button>
                    </form>
                </div>

                {/* Harvests List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold mb-4">Your Active Listings</h2>
                    {loading ? (
                        <p>Loading harvests...</p>
                    ) : harvests.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border text-center text-slate-500">
                            You haven't listed any harvests yet.
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {harvests.map((harvest) => (
                                <div key={harvest._id} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-green-700 dark:text-green-500">{harvest.cropType}</h3>
                                            <p className="text-sm text-slate-500">{harvest.location}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${harvest.status === 'available' ? 'bg-blue-100 text-blue-800' :
                                            harvest.status === 'bidding' ? 'bg-orange-100 text-orange-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                            {harvest.status.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Quantity:</span>
                                            <span className="font-medium">{harvest.quantity} kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Quality:</span>
                                            <span className="font-medium">Grade {harvest.qualityGrade}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Base Price:</span>
                                            <span className="font-medium text-green-600">₹{harvest.basePrice}/kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Listed On:</span>
                                            <span className="font-medium">{new Date(harvest.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {harvest.latestBid && (
                                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                                            <span className="font-semibold text-green-800 flex items-center gap-1">
                                                <span className="relative flex h-3 w-3 mr-1">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                                </span>
                                                Highest Bid
                                            </span>
                                            <span className="font-bold text-lg text-green-700">₹{harvest.latestBid}</span>
                                        </div>
                                    )}

                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                        <Button variant="outline" className="w-full">
                                            View All Bids
                                        </Button>
                                        <Button className="w-full bg-green-600 hover:bg-green-700" disabled={!harvest.latestBid}>
                                            Accept Highest
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
