"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOut } from "next-auth/react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

interface Harvest {
    _id: string;
    farmerId: {
        _id: string;
        name: string;
    };
    cropType: string;
    quantity: number;
    qualityGrade: string;
    basePrice: number;
    location: string;
    status: string;
    createdAt: string;
    latestBid?: number;
}

export default function MandiDashboard() {
    const [marketHarvests, setMarketHarvests] = useState<Harvest[]>([]);
    const [loading, setLoading] = useState(true);

    // Bidding State
    const [biddingHarvestId, setBiddingHarvestId] = useState<string | null>(null);
    const [bidAmount, setBidAmount] = useState("");
    const [dropoffLocation, setDropoffLocation] = useState("");
    const [submittingBid, setSubmittingBid] = useState(false);
    const [bidError, setBidError] = useState("");

    useEffect(() => {
        const fetchMarket = async () => {
            try {
                const res = await fetch("/api/market");
                if (res.ok) {
                    const data = await res.json();
                    setMarketHarvests(data);
                }
            } catch (err) {
                console.error("Failed to fetch market data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMarket();

        // Set up Firebase listener for all latest bids
        const latestBidsRef = ref(database, "latestBids");
        const unsubscribe = onValue(latestBidsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setMarketHarvests((currentHarvests) =>
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

    const handlePlaceBid = async (harvestId: string, currentHighest: number) => {
        const amountNum = Number(bidAmount);
        if (!amountNum || amountNum <= currentHighest) {
            setBidError(`Bid must be greater than ₹${currentHighest}`);
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
            } else {
                const data = await res.json();
                setBidError(data.message || "Failed to place bid");
            }
        } catch (err) {
            setBidError("Network error occurred");
        } finally {
            setSubmittingBid(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        Market Dashboard
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">
                        View available produce and place your bids.
                    </p>
                </div>
                <Button variant="outline" onClick={() => signOut()}>
                    Sign Out
                </Button>
            </header>

            <div className="space-y-6">
                <h2 className="text-xl font-bold border-b pb-2">Live Marketplace</h2>

                {loading ? (
                    <p>Loading the market...</p>
                ) : marketHarvests.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border text-center text-slate-500">
                        No harvests are currently listed by farmers.
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {marketHarvests.map((harvest) => (
                            <div key={harvest._id} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-xl text-green-700 dark:text-green-500">{harvest.cropType}</h3>
                                            <p className="text-sm text-slate-500">{harvest.location}</p>
                                        </div>
                                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                                            ₹{harvest.basePrice} / kg
                                        </span>
                                    </div>

                                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-6">
                                        <p><strong>Farmer:</strong> {harvest.farmerId?.name || "Unknown"}</p>
                                        <div className="flex justify-between">
                                            <span>Quantity available:</span>
                                            <span className="font-semibold">{harvest.quantity} kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Quality Grade:</span>
                                            <span className="font-semibold text-amber-600">Grade {harvest.qualityGrade}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Listed:</span>
                                            <span>{new Date(harvest.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        {harvest.latestBid && (
                                            <div className="flex justify-between text-green-700 bg-green-50 p-2 rounded -mx-2">
                                                <span className="font-bold">Current Highest Bid:</span>
                                                <span className="font-bold">₹{harvest.latestBid}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {biddingHarvestId === harvest._id ? (
                                    <div className="space-y-2 mt-4">
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                placeholder={`> ₹${harvest.latestBid || harvest.basePrice}`}
                                                value={bidAmount}
                                                onChange={(e) => setBidAmount(e.target.value)}
                                            />
                                            <Input
                                                type="text"
                                                placeholder="Drop-off Location"
                                                value={dropoffLocation}
                                                onChange={(e) => setDropoffLocation(e.target.value)}
                                            />
                                            <Button
                                                className="bg-green-600 hover:bg-green-700"
                                                disabled={submittingBid}
                                                onClick={() => handlePlaceBid(harvest._id, harvest.latestBid || harvest.basePrice)}
                                            >
                                                Submit
                                            </Button>
                                        </div>
                                        {bidError && <span className="text-red-500 text-xs block">{bidError}</span>}
                                        <Button variant="ghost" className="w-full text-sm h-8" onClick={() => {
                                            setBiddingHarvestId(null);
                                            setBidError("");
                                        }}>
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                                        onClick={() => setBiddingHarvestId(harvest._id)}
                                    >
                                        Place a Bid
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
