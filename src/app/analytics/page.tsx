"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface PricePoint {
    date: string;
    avgPrice: number;
    totalQty: number;
}

interface CropSummary {
    crop: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    totalQuantity: number;
    count: number;
}

export default function AnalyticsPage() {
    const [crop, setCrop] = useState("Tomato");
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
    const [cropSummary, setCropSummary] = useState<CropSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const crops = ["Tomato", "Potato", "Onion", "Rice", "Wheat", "Corn", "Apple", "Mango", "Banana"];

    useEffect(() => {
        fetch("/api/analytics/crop-summary")
            .then((r) => r.json())
            .then(setCropSummary)
            .catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/analytics/price-history?crop=${encodeURIComponent(crop)}`)
            .then((r) => r.json())
            .then(setPriceHistory)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [crop]);

    const router = useRouter();

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-black dark:hover:text-white transition-colors mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back
                </button>
                <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Price Analytics</h1>
                <p className="text-sm text-neutral-500 mb-8">Market price trends and crop performance data</p>

                {/* Crop selector */}
                <div className="flex gap-2 flex-wrap mb-8">
                    {crops.map((c) => (
                        <button
                            key={c}
                            onClick={() => setCrop(c)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                                ${c === crop
                                    ? "bg-black text-white dark:bg-white dark:text-black"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                {/* Price history line chart */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 mb-8">
                    <h2 className="text-lg font-semibold text-black dark:text-white mb-1">Price History — {crop}</h2>
                    <p className="text-xs text-neutral-400 mb-6">Average price per kg over time</p>

                    {loading ? (
                        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm">Loading chart...</div>
                    ) : priceHistory.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm">No price data available for {crop}</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={priceHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                                <Tooltip
                                    contentStyle={{
                                        background: "white",
                                        border: "1px solid #e5e5e5",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                    }}
                                />
                                <Line type="monotone" dataKey="avgPrice" stroke="#000" strokeWidth={2} dot={{ r: 3 }} name="Avg Price (₹/kg)" />
                                <Line type="monotone" dataKey="totalQty" stroke="#a3a3a3" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Volume (kg)" />
                                <Legend />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Crop summary bar chart */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-black dark:text-white mb-1">Crop Comparison</h2>
                    <p className="text-xs text-neutral-400 mb-6">Average, minimum, and maximum prices across all crops</p>

                    {cropSummary.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm">No data available</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={cropSummary}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                                <XAxis dataKey="crop" tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
                                <Tooltip
                                    contentStyle={{
                                        background: "white",
                                        border: "1px solid #e5e5e5",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                    }}
                                />
                                <Bar dataKey="avgPrice" fill="#000" radius={[6, 6, 0, 0]} name="Avg Price" />
                                <Bar dataKey="maxPrice" fill="#a3a3a3" radius={[6, 6, 0, 0]} name="Max Price" />
                                <Bar dataKey="minPrice" fill="#d4d4d4" radius={[6, 6, 0, 0]} name="Min Price" />
                                <Legend />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Summary table */}
                {cropSummary.length > 0 && (
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 mt-8 overflow-x-auto">
                        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Market Summary</h2>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 dark:border-neutral-700 text-left text-xs text-neutral-500">
                                    <th className="pb-2 font-medium">Crop</th>
                                    <th className="pb-2 font-medium">Avg Price</th>
                                    <th className="pb-2 font-medium">Min</th>
                                    <th className="pb-2 font-medium">Max</th>
                                    <th className="pb-2 font-medium">Total Qty</th>
                                    <th className="pb-2 font-medium">Listings</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cropSummary.map((c) => (
                                    <tr key={c.crop} className="border-b border-neutral-50 dark:border-neutral-800">
                                        <td className="py-2.5 font-medium text-black dark:text-white">{c.crop}</td>
                                        <td className="py-2.5">₹{c.avgPrice.toFixed(1)}</td>
                                        <td className="py-2.5">₹{c.minPrice}</td>
                                        <td className="py-2.5">₹{c.maxPrice}</td>
                                        <td className="py-2.5">{c.totalQuantity} kg</td>
                                        <td className="py-2.5">{c.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
