"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";
import StarRating from "@/components/StarRating";
import MapView from "@/components/MapView";
import AIOpsAssistant from "@/components/AIOpsAssistant";
import Link from "next/link";

interface DeliveryRequest {
    _id: string;
    harvestId: {
        _id: string;
        cropType: string;
        quantity: number;
        location: string;
    };
    requesterId: {
        _id: string;
        name: string;
    };
    pickupLocation: string;
    dropoffLocation: string;
    status: "pending" | "accepted" | "in_transit" | "delivered";
    createdAt: string;
}

interface RoutePoint {
    lat: number;
    lng: number;
    label?: string;
}

interface RouteOptimization {
    pickup: RoutePoint;
    dropoff: RoutePoint;
    distanceKm: number;
    durationMinutes: number;
    routePath: RoutePoint[];
    checkpoints: RoutePoint[];
    vehicleRecommendation: string;
    estimatedCost: {
        currency: string;
        min: number;
        max: number;
    };
    fuelPlan?: {
        vehicleClass: string;
        assumedMileageKmpl: number;
        estimatedFuelLiters: number;
        safetyBufferLiters: number;
        suggestedFuelLiters: number;
        assumedDieselPricePerLiter: number;
        estimatedFuelCost: number;
    };
    fuelStations?: Array<{
        name: string;
        brand?: string;
        lat: number;
        lng: number;
        distanceFromPickupKm?: number;
    }>;
    strategy: string;
}

const statusStyles: Record<string, string> = {
    pending: "bg-neutral-100 text-neutral-600",
    accepted: "bg-neutral-200 text-neutral-700",
    in_transit: "bg-neutral-800 text-white",
    delivered: "bg-black text-white",
};

const nextStatus: Record<string, string> = {
    accepted: "in_transit",
    in_transit: "delivered",
};

const nextStatusLabel: Record<string, string> = {
    accepted: "Mark In Transit",
    in_transit: "Mark Delivered",
};

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

type Tab = "overview" | "available" | "active" | "completed";

export default function TransporterDashboard() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<DeliveryRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ id: string; status: string; label: string; req?: DeliveryRequest } | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"newest" | "quantity" | "crop">("newest");
    const [ratingSubmitted, setRatingSubmitted] = useState<Record<string, boolean>>({});

    const [aiAdvice, setAiAdvice] = useState<Record<string, string>>({});
    const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
    const [routePlans, setRoutePlans] = useState<Record<string, RouteOptimization>>({});
    const [routeLoading, setRouteLoading] = useState<Record<string, boolean>>({});
    const [pickupChecklist, setPickupChecklist] = useState<Record<string, { cargoLoaded: boolean; documentsChecked: boolean; pickupVerified: boolean }>>({});
    const [deliveryConfirmation, setDeliveryConfirmation] = useState<Record<string, { receiverName: string; proofNote: string; deliveredQuantity: string }>>({});

    const fetchRouteAdvice = async (req: DeliveryRequest) => {
        setAiLoading(prev => ({ ...prev, [req._id]: true }));
        try {
            const res = await fetch("/api/predict/route-advice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cropType: req.harvestId?.cropType || "Produce",
                    quantity: req.harvestId?.quantity || 0,
                    pickupLocation: req.pickupLocation,
                    dropoffLocation: req.dropoffLocation,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setAiAdvice(prev => ({ ...prev, [req._id]: data.advice }));
            }
        } catch { /* silent */ }
        setAiLoading(prev => ({ ...prev, [req._id]: false }));
    };

    const optimizeRoute = async (req: DeliveryRequest) => {
        setRouteLoading(prev => ({ ...prev, [req._id]: true }));
        try {
            const res = await fetch("/api/predict/route-optimization", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cropType: req.harvestId?.cropType || "Produce",
                    quantity: req.harvestId?.quantity || 0,
                    pickupLocation: req.pickupLocation,
                    dropoffLocation: req.dropoffLocation,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Failed to optimize route");
            }
            const data = await res.json();
            setRoutePlans(prev => ({ ...prev, [req._id]: data }));
            showToast("AI route optimized with maps");
        } catch (err) {
            console.error("Failed to optimize route", err);
            showToast("Route optimization unavailable right now");
        } finally {
            setRouteLoading(prev => ({ ...prev, [req._id]: false }));
        }
    };

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    const fetchRequests = async () => {
        try {
            const res = await fetch("/api/delivery-requests");
            if (res.ok) setRequests(await res.json());
        } catch (err) {
            console.error("Failed to fetch requests", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!confirmAction) return;
        if (confirmAction.status === "in_transit") {
            setPickupChecklist(prev => ({
                ...prev,
                [confirmAction.id]: prev[confirmAction.id] || {
                    cargoLoaded: false,
                    documentsChecked: false,
                    pickupVerified: false,
                },
            }));
        }
        if (confirmAction.status === "delivered") {
            setDeliveryConfirmation(prev => ({
                ...prev,
                [confirmAction.id]: prev[confirmAction.id] || {
                    receiverName: "",
                    proofNote: "",
                    deliveredQuantity: String(confirmAction.req?.harvestId?.quantity || ""),
                },
            }));
        }
    }, [confirmAction]);

    const handleUpdateStatus = async (id: string, status: string, workflowMeta?: Record<string, unknown>) => {
        setUpdating(id);
        setConfirmAction(null);
        try {
            const res = await fetch(`/api/delivery-requests/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, workflowMeta }),
            });
            if (res.ok) {
                fetchRequests();
                const labels: Record<string, string> = { accepted: "Request accepted", in_transit: "Delivery in transit", delivered: "Delivery completed" };
                showToast(labels[status] || "Status updated");
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.detail || "Status update failed");
            }
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setUpdating(null);
        }
    };

    const handleConfirmAction = async () => {
        if (!confirmAction) return;

        if (confirmAction.status === "in_transit") {
            const checklist = pickupChecklist[confirmAction.id] || { cargoLoaded: false, documentsChecked: false, pickupVerified: false };
            const routePlan = routePlans[confirmAction.id];
            if (!checklist.cargoLoaded || !checklist.documentsChecked || !checklist.pickupVerified) {
                showToast("Complete pickup checklist first");
                return;
            }
            if (!routePlan) {
                showToast("Run AI route optimization before transit");
                return;
            }
            await handleUpdateStatus(confirmAction.id, confirmAction.status, {
                pickupChecklist: checklist,
                routePlan: {
                    distanceKm: routePlan.distanceKm,
                    durationMinutes: routePlan.durationMinutes,
                    strategy: routePlan.strategy,
                    checkpoints: routePlan.checkpoints,
                },
            });
            return;
        }

        if (confirmAction.status === "delivered") {
            const form = deliveryConfirmation[confirmAction.id] || { receiverName: "", proofNote: "", deliveredQuantity: "" };
            if (!form.receiverName.trim() || form.proofNote.trim().length < 8 || Number(form.deliveredQuantity) <= 0) {
                showToast("Receiver name, proof note and quantity are required");
                return;
            }
            await handleUpdateStatus(confirmAction.id, confirmAction.status, {
                deliveryConfirmation: {
                    receiverName: form.receiverName.trim(),
                    proofNote: form.proofNote.trim(),
                    deliveredQuantity: Number(form.deliveredQuantity),
                },
            });
            return;
        }

        await handleUpdateStatus(confirmAction.id, confirmAction.status);
    };

    const pending = useMemo(() => requests.filter(r => r.status === "pending"), [requests]);
    const active = useMemo(() => requests.filter(r => ["accepted", "in_transit"].includes(r.status)), [requests]);
    const completed = useMemo(() => requests.filter(r => r.status === "delivered"), [requests]);
    const totalKgDelivered = useMemo(() =>
        completed.reduce((sum, r) => sum + (r.harvestId?.quantity || 0), 0), [completed]);
    const totalKgActive = useMemo(() =>
        active.reduce((sum, r) => sum + (r.harvestId?.quantity || 0), 0), [active]);

    const handleRateRequester = async (requesterId: string, score: number) => {
        try {
            await fetch("/api/ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toUser: requesterId, score, comment: "" }),
            });
            setRatingSubmitted((prev) => ({ ...prev, [requesterId]: true }));
        } catch { /* ignore */ }
    };

    const filterAndSort = (list: DeliveryRequest[]) => {
        let filtered = list;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = list.filter(r =>
                r.harvestId?.cropType?.toLowerCase().includes(q) ||
                r.pickupLocation?.toLowerCase().includes(q) ||
                r.dropoffLocation?.toLowerCase().includes(q) ||
                r.requesterId?.name?.toLowerCase().includes(q)
            );
        }
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case "quantity": return (b.harvestId?.quantity || 0) - (a.harvestId?.quantity || 0);
                case "crop": return (a.harvestId?.cropType || "").localeCompare(b.harvestId?.cropType || "");
                default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });
    };

    const tabs: { key: Tab; label: string; count?: number }[] = [
        { key: "overview", label: "Overview" },
        { key: "available", label: "Available", count: pending.length },
        { key: "active", label: "Active", count: active.length },
        { key: "completed", label: "Completed", count: completed.length },
    ];

    return (
        <AppShell>
            {/* Toast notification */}
            {toast && (
                <div className="fixed top-20 right-6 z-50 bg-black dark:bg-white text-white dark:text-black px-5 py-3 rounded-2xl shadow-lg text-sm font-medium">
                    {toast}
                </div>
            )}

            {/* Confirm modal */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-black dark:text-white mb-2">Confirm Action</h3>
                        <p className="text-neutral-500 text-sm mb-6">
                            {confirmAction.status === "in_transit"
                                ? "Transit start requires a verified pickup checklist and AI route optimization."
                                : confirmAction.status === "delivered"
                                  ? "Delivery completion requires receiver verification and proof details."
                                  : `Are you sure you want to ${confirmAction.label.toLowerCase()}?`}
                        </p>

                        {confirmAction.status === "in_transit" && (
                            <div className="space-y-4 mb-6">
                                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                        <div className="text-sm font-semibold text-black dark:text-white">Pickup Readiness Checklist</div>
                                        <Button
                                            variant="outline"
                                            className="rounded-full"
                                            disabled={routeLoading[confirmAction.id]}
                                            onClick={() => confirmAction.req && optimizeRoute(confirmAction.req)}
                                        >
                                            {routeLoading[confirmAction.id] ? "Optimizing..." : "Optimize Route with AI"}
                                        </Button>
                                    </div>
                                    {[
                                        { key: "cargoLoaded", label: "Cargo loaded and sealed" },
                                        { key: "documentsChecked", label: "Permit/challan verified" },
                                        { key: "pickupVerified", label: "Pickup location physically verified" },
                                    ].map((item) => (
                                        <label key={item.key} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 mt-2">
                                            <input
                                                type="checkbox"
                                                checked={pickupChecklist[confirmAction.id]?.[item.key as "cargoLoaded" | "documentsChecked" | "pickupVerified"] || false}
                                                onChange={(e) =>
                                                    setPickupChecklist((prev) => ({
                                                        ...prev,
                                                        [confirmAction.id]: {
                                                            ...(prev[confirmAction.id] || {
                                                                cargoLoaded: false,
                                                                documentsChecked: false,
                                                                pickupVerified: false,
                                                            }),
                                                            [item.key]: e.target.checked,
                                                        },
                                                    }))
                                                }
                                            />
                                            {item.label}
                                        </label>
                                    ))}
                                </div>

                                {routePlans[confirmAction.id] && (
                                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                <div className="text-neutral-400">Distance</div>
                                                <div className="font-semibold text-black dark:text-white">{routePlans[confirmAction.id].distanceKm} km</div>
                                            </div>
                                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                <div className="text-neutral-400">ETA</div>
                                                <div className="font-semibold text-black dark:text-white">{routePlans[confirmAction.id].durationMinutes} min</div>
                                            </div>
                                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                <div className="text-neutral-400">Vehicle</div>
                                                <div className="font-semibold text-black dark:text-white">{routePlans[confirmAction.id].vehicleRecommendation}</div>
                                            </div>
                                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                <div className="text-neutral-400">Cost</div>
                                                <div className="font-semibold text-black dark:text-white">Rs {routePlans[confirmAction.id].estimatedCost.min} - {routePlans[confirmAction.id].estimatedCost.max}</div>
                                            </div>
                                        </div>
                                        {routePlans[confirmAction.id].fuelPlan && (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                    <div className="text-neutral-400">Mileage</div>
                                                    <div className="font-semibold text-black dark:text-white">{routePlans[confirmAction.id].fuelPlan?.assumedMileageKmpl} km/l</div>
                                                </div>
                                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                    <div className="text-neutral-400">Fuel Needed</div>
                                                    <div className="font-semibold text-black dark:text-white">{routePlans[confirmAction.id].fuelPlan?.estimatedFuelLiters} L</div>
                                                </div>
                                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                    <div className="text-neutral-400">Suggested Fuel</div>
                                                    <div className="font-semibold text-black dark:text-white">{routePlans[confirmAction.id].fuelPlan?.suggestedFuelLiters} L</div>
                                                </div>
                                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                                    <div className="text-neutral-400">Fuel Cost</div>
                                                    <div className="font-semibold text-black dark:text-white">Rs {routePlans[confirmAction.id].fuelPlan?.estimatedFuelCost}</div>
                                                </div>
                                            </div>
                                        )}
                                        {routePlans[confirmAction.id].fuelStations && routePlans[confirmAction.id].fuelStations.length > 0 && (
                                            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-2">
                                                <div className="text-xs font-semibold text-black dark:text-white mb-1">Nearby Fuel Stations</div>
                                                <div className="space-y-1">
                                                    {routePlans[confirmAction.id].fuelStations?.slice(0, 4).map((s, idx) => (
                                                        <div key={`${s.lat}-${s.lng}-${idx}`} className="text-xs text-neutral-600 dark:text-neutral-300">
                                                            {s.name}{s.brand ? ` (${s.brand})` : ""} / {s.distanceFromPickupKm ?? "-"} km from pickup
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <MapView
                                            pickup={routePlans[confirmAction.id].pickup}
                                            dropoff={routePlans[confirmAction.id].dropoff}
                                            routePath={routePlans[confirmAction.id].routePath}
                                            checkpoints={routePlans[confirmAction.id].checkpoints}
                                            height="220px"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {confirmAction.status === "delivered" && (
                            <div className="space-y-3 mb-6">
                                <Input
                                    placeholder="Receiver name"
                                    value={deliveryConfirmation[confirmAction.id]?.receiverName || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setDeliveryConfirmation(prev => ({
                                            ...prev,
                                            [confirmAction.id]: {
                                                ...(prev[confirmAction.id] || { receiverName: "", proofNote: "", deliveredQuantity: "" }),
                                                receiverName: e.target.value,
                                            },
                                        }))
                                    }
                                />
                                <Input
                                    type="number"
                                    min={1}
                                    placeholder="Delivered quantity (kg)"
                                    value={deliveryConfirmation[confirmAction.id]?.deliveredQuantity || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setDeliveryConfirmation(prev => ({
                                            ...prev,
                                            [confirmAction.id]: {
                                                ...(prev[confirmAction.id] || { receiverName: "", proofNote: "", deliveredQuantity: "" }),
                                                deliveredQuantity: e.target.value,
                                            },
                                        }))
                                    }
                                />
                                <textarea
                                    className="w-full min-h-24 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm"
                                    placeholder="Proof note (photo ref, OTP verified, delivery condition etc.)"
                                    value={deliveryConfirmation[confirmAction.id]?.proofNote || ""}
                                    onChange={(e) =>
                                        setDeliveryConfirmation(prev => ({
                                            ...prev,
                                            [confirmAction.id]: {
                                                ...(prev[confirmAction.id] || { receiverName: "", proofNote: "", deliveredQuantity: "" }),
                                                proofNote: e.target.value,
                                            },
                                        }))
                                    }
                                />
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 rounded-full" onClick={() => setConfirmAction(null)}>Cancel</Button>
                            <Button className="flex-1 bg-black hover:bg-neutral-800 text-white rounded-full"
                                disabled={updating === confirmAction.id}
                                onClick={handleConfirmAction}>
                                {updating === confirmAction.id ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </span>
                                ) : "Confirm"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
                {/* Tabs */}
                <div className="flex gap-1 mb-6 overflow-x-auto">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-all duration-200
                                ${activeTab === t.key ? "bg-black dark:bg-white text-white dark:text-black shadow-sm" : "text-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>
                            {t.label}
                            {t.count !== undefined && t.count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? "bg-white/20" : "bg-neutral-200 dark:bg-neutral-700"}`}>{t.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                <AIOpsAssistant title="Transport AI Assistant" subtitle="Ask about delivery workload, active routes, and operational priorities." />

                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 animate-pulse">
                                <div className="flex justify-between mb-4">
                                    <div className="space-y-2">
                                        <div className="h-5 w-28 bg-neutral-200 dark:bg-neutral-700 rounded" />
                                        <div className="h-3 w-20 bg-neutral-100 dark:bg-neutral-800 rounded" />
                                    </div>
                                    <div className="h-6 w-16 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                                </div>
                                <div className="space-y-3">
                                    <div className="h-12 w-full bg-neutral-50 dark:bg-neutral-800 rounded-lg" />
                                    <div className="h-12 w-full bg-neutral-50 dark:bg-neutral-800 rounded-lg" />
                                </div>
                                <div className="h-10 mt-4 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* OVERVIEW TAB */}
                        {activeTab === "overview" && (
                            <div className="space-y-8">
                                <div>
                                    <h1 className="text-3xl font-bold text-black dark:text-white">Welcome back, {user?.name?.split(" ")[0]}</h1>
                                    <p className="text-neutral-500 dark:text-neutral-400 mt-1">Here is your transport activity summary.</p>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: "Available Jobs", value: pending.length, action: () => setActiveTab("available"), accent: false },
                                        { label: "Active Deliveries", value: active.length, action: () => setActiveTab("active"), accent: true },
                                        { label: "Completed", value: completed.length, action: () => setActiveTab("completed"), accent: false },
                                        { label: "kg Delivered", value: totalKgDelivered.toLocaleString(), accent: false },
                                    ].map(s => (
                                        <div key={s.label}
                                            className={`p-5 rounded-2xl border transition-all duration-200
                                                ${s.action ? "cursor-pointer hover:scale-[1.02] hover:shadow-md" : ""}
                                                ${s.accent ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white" : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"}`}
                                            onClick={s.action}>
                                            <div className={`text-2xl font-bold ${s.accent ? "text-white dark:text-black" : "text-black dark:text-white"}`}>{s.value}</div>
                                            <div className={`text-sm mt-1 ${s.accent ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-500 dark:text-neutral-400"}`}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Performance breakdown */}
                                {requests.length > 0 && (() => {
                                    const routes = new Set(requests.map(r => `${r.pickupLocation}→${r.dropoffLocation}`));
                                    const crops = new Set(requests.filter(r => r.harvestId?.cropType).map(r => r.harvestId.cropType));
                                    const completionRate = requests.length > 0 ? Math.round((completed.length / requests.length) * 100) : 0;
                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
                                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3 font-medium">Produce Handled</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {[...crops].slice(0, 8).map(c => (
                                                        <span key={c} className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white">
                                                            {c}
                                                        </span>
                                                    ))}
                                                    {crops.size === 0 && <span className="text-sm text-neutral-400">None yet</span>}
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
                                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 font-medium">Performance</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <div className="text-xl font-bold text-black dark:text-white tabular-nums">{completionRate}%</div>
                                                        <div className="text-[10px] text-neutral-400">Completion Rate</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xl font-bold text-black dark:text-white tabular-nums">{routes.size}</div>
                                                        <div className="text-[10px] text-neutral-400">Unique Routes</div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-black dark:bg-white rounded-full transition-all" style={{ width: `${completionRate}%` }} />
                                                </div>
                                            </div>
                                            <div className="bg-black dark:bg-white rounded-2xl p-5 text-white dark:text-black">
                                                <div className="text-xs opacity-60 mb-2 font-medium">Lifetime Cargo</div>
                                                <div className="text-2xl font-bold tabular-nums">{totalKgDelivered.toLocaleString()} kg</div>
                                                <div className="text-xs opacity-50 mt-1">{completed.length} deliveries completed</div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Active in-transit banner */}
                                {active.filter(r => r.status === "in_transit").length > 0 && (
                                    <div className="bg-black text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <div className="text-sm text-neutral-300">Currently in transit</div>
                                            <div className="text-xl font-bold">{active.filter(r => r.status === "in_transit").length} deliveries / {totalKgActive.toLocaleString()} kg</div>
                                        </div>
                                        <Button className="bg-white text-black hover:bg-neutral-100 rounded-full" onClick={() => setActiveTab("active")}>
                                            View Active
                                        </Button>
                                    </div>
                                )}

                                {/* Active deliveries summary */}
                                {active.length > 0 && (
                                    <div>
                                        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Current Deliveries</h2>
                                        <div className="space-y-3">
                                            {active.map(req => (
                                                <ActiveDeliveryRow key={req._id} req={req}
                                                    updating={updating}
                                                    routePlan={routePlans[req._id]}
                                                    onConfirm={(id, status, label, actionReq) => setConfirmAction({ id, status, label, req: actionReq })} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Available preview */}
                                {pending.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-lg font-semibold text-black dark:text-white">New Requests</h2>
                                            <button onClick={() => setActiveTab("available")} className="text-sm text-neutral-500 hover:text-black font-medium transition-colors">
                                                View all ({pending.length})
                                            </button>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {pending.slice(0, 3).map(req => (
                                                <DeliveryCard key={req._id} req={req}
                                                    actionLabel="Accept Request"
                                                    onAction={() => setConfirmAction({ id: req._id, status: "accepted", label: "Accept Request", req })}
                                                    isUpdating={updating === req._id}
                                                    expanded={expandedId === req._id}
                                                    onToggleExpand={() => setExpandedId(expandedId === req._id ? null : req._id)}
                                                    aiAdvice={aiAdvice[req._id]}
                                                    aiLoading={aiLoading[req._id]}
                                                    routePlan={routePlans[req._id]}
                                                    routeLoading={routeLoading[req._id]}
                                                    onAskAI={() => fetchRouteAdvice(req)}
                                                    onOptimizeRoute={() => optimizeRoute(req)} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {requests.length === 0 && (
                                    <div className="bg-white dark:bg-neutral-900 p-16 rounded-2xl border border-neutral-200 dark:border-neutral-700 text-center">
                                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                        </div>
                                        <div className="text-neutral-400 text-lg font-medium mb-2">No delivery requests yet</div>
                                        <p className="text-neutral-500 text-sm">Requests will appear here when farmers sell their produce to mandi owners.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AVAILABLE TAB */}
                        {activeTab === "available" && (
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-end justify-between gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-black dark:text-white">Available Requests</h1>
                                        <p className="text-neutral-500 mt-1">{pending.length} delivery {pending.length === 1 ? "request" : "requests"} waiting to be picked up.</p>
                                    </div>
                                </div>

                                {/* Search and sort */}
                                {pending.length > 0 && (
                                    <div className="flex flex-wrap gap-3">
                                        <div className="flex-1 min-w-[200px] relative">
                                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <Input placeholder="Search crop, location, requester..."
                                                value={searchQuery}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                                className="h-10 pl-10" />
                                        </div>
                                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                            className="h-10 rounded-full border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 text-sm text-black dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors">
                                            <option value="newest">Newest First</option>
                                            <option value="quantity">Largest Quantity</option>
                                            <option value="crop">Crop A-Z</option>
                                        </select>
                                    </div>
                                )}

                                {pending.length === 0 ? (
                                    <div className="bg-white dark:bg-neutral-900 p-16 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-600 text-center">
                                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                        </div>
                                        <div className="text-neutral-400 text-lg font-medium">No pending requests right now</div>
                                        <p className="text-neutral-500 text-sm mt-1">Check back soon for new delivery jobs.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {filterAndSort(pending).map((req) => (
                                            <DeliveryCard key={req._id} req={req}
                                                actionLabel="Accept Request"
                                                onAction={() => setConfirmAction({ id: req._id, status: "accepted", label: "Accept Request", req })}
                                                isUpdating={updating === req._id}
                                                expanded={expandedId === req._id}
                                                onToggleExpand={() => setExpandedId(expandedId === req._id ? null : req._id)}
                                                aiAdvice={aiAdvice[req._id]}
                                                aiLoading={aiLoading[req._id]}
                                                routePlan={routePlans[req._id]}
                                                routeLoading={routeLoading[req._id]}
                                                onAskAI={() => fetchRouteAdvice(req)}
                                                onOptimizeRoute={() => optimizeRoute(req)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ACTIVE TAB */}
                        {activeTab === "active" && (
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-end justify-between gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-black dark:text-white">Active Deliveries</h1>
                                        <p className="text-neutral-500 dark:text-neutral-400 mt-1">{active.length} {active.length === 1 ? "delivery" : "deliveries"} in progress.</p>
                                    </div>
                                    {totalKgActive > 0 && (
                                        <div className="bg-black text-white px-5 py-3 rounded-2xl">
                                            <div className="text-xl font-bold">{totalKgActive.toLocaleString()} kg</div>
                                            <div className="text-xs text-neutral-300">In Transit</div>
                                        </div>
                                    )}
                                </div>
                                {active.length === 0 ? (
                                    <div className="bg-white dark:bg-neutral-900 p-16 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-600 text-center">
                                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                        </div>
                                        <div className="text-neutral-400 text-lg font-medium">No active deliveries</div>
                                        <p className="text-neutral-500 text-sm mt-1">Accept a request to get started.</p>
                                        <Button className="mt-4 bg-black text-white rounded-full hover:bg-neutral-800" onClick={() => setActiveTab("available")}>
                                            View Available
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {active.map((req) => (
                                            <ActiveDeliveryRow key={req._id} req={req}
                                                updating={updating}
                                                routePlan={routePlans[req._id]}
                                                onConfirm={(id, status, label, actionReq) => setConfirmAction({ id, status, label, req: actionReq })}
                                                showExpanded />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* COMPLETED TAB */}
                        {activeTab === "completed" && (
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-end justify-between gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-black dark:text-white">Completed Deliveries</h1>
                                        <p className="text-neutral-500 mt-1">{completed.length} {completed.length === 1 ? "delivery" : "deliveries"} completed.</p>
                                    </div>
                                    {completed.length > 0 && (
                                        <div className="flex gap-3">
                                            <div className="bg-white dark:bg-neutral-900 px-5 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                                                <div className="text-xl font-bold text-black dark:text-white">{completed.length}</div>
                                                <div className="text-xs text-neutral-500">Total Trips</div>
                                            </div>
                                            <div className="bg-black text-white px-5 py-3 rounded-2xl">
                                                <div className="text-xl font-bold">{totalKgDelivered.toLocaleString()} kg</div>
                                                <div className="text-xs text-neutral-300">Delivered</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {completed.length === 0 ? (
                                    <div className="bg-white dark:bg-neutral-900 p-16 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-600 text-center">
                                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div className="text-neutral-400 text-lg font-medium">No completed deliveries yet</div>
                                        <p className="text-neutral-500 text-sm mt-1">Your delivery history will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {completed.map((req) => (
                                            <div key={req._id}>
                                                <DeliveryCard req={req}
                                                    expanded={expandedId === req._id}
                                                    onToggleExpand={() => setExpandedId(expandedId === req._id ? null : req._id)} />
                                                <div className="mt-2 px-4 flex flex-wrap items-center gap-3">
                                                    {req.requesterId && !ratingSubmitted[req.requesterId._id] && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-neutral-400">Rate:</span>
                                                            <StarRating value={0} size="sm" onChange={(score) => handleRateRequester(req.requesterId._id, score)} />
                                                        </div>
                                                    )}
                                                    {req.requesterId && ratingSubmitted[req.requesterId._id] && (
                                                        <span className="text-xs text-neutral-400">Rated</span>
                                                    )}
                                                    <Link href={`/invoice/${req._id}`}
                                                        className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                                                        Invoice
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppShell>
    );
}

/* Expanded active delivery row with full route visualization and step indicators */
function ActiveDeliveryRow({
    req,
    updating,
    onConfirm,
    routePlan,
    showExpanded = false,
}: {
    req: DeliveryRequest;
    updating: string | null;
    onConfirm: (id: string, status: string, label: string, req: DeliveryRequest) => void;
    routePlan?: RouteOptimization;
    showExpanded?: boolean;
}) {
    const steps = [
        { key: "pending", label: "Requested" },
        { key: "accepted", label: "Accepted" },
        { key: "in_transit", label: "In Transit" },
        { key: "delivered", label: "Delivered" },
    ];
    const curIdx = steps.findIndex(s => s.key === req.status);

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-200 hover:shadow-sm overflow-hidden">
            <div className="p-5">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-sm font-bold">
                            {req.harvestId?.cropType?.charAt(0).toUpperCase() || "P"}
                        </div>
                        <div>
                            <div className="font-semibold text-black dark:text-white">{req.harvestId?.cropType || "Produce"} -- {req.harvestId?.quantity} kg</div>
                            <div className="text-xs text-neutral-400">For: {req.requesterId?.name || "Farmer"} / {timeAgo(req.createdAt)}</div>
                            {req.requesterId?._id && (
                                <Link href={`/chat?userId=${req.requesterId._id}`} className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white underline-offset-2 hover:underline">
                                    Message requester
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium tracking-wide ${statusStyles[req.status]}`}>
                            {req.status.replace("_", " ").toUpperCase()}
                        </span>
                        {nextStatusLabel[req.status] && (
                            <Button className="bg-black hover:bg-neutral-800 text-white rounded-full text-sm transition-all duration-200 hover:shadow-md"
                                onClick={() => onConfirm(req._id, nextStatus[req.status], nextStatusLabel[req.status], req)}
                                disabled={updating === req._id}>
                                {updating === req._id ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Updating...
                                    </span>
                                ) : nextStatusLabel[req.status]}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Route visualization */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3">
                        <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mb-0.5">Pickup</div>
                        <div className="text-sm text-black dark:text-white font-medium">{req.pickupLocation}</div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span className="text-[9px] text-neutral-300">{req.harvestId?.quantity} kg</span>
                    </div>
                    <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3">
                        <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mb-0.5">Drop-off</div>
                        <div className="text-sm text-black dark:text-white font-medium">{req.dropoffLocation}</div>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center">
                    {steps.map((step, i) => (
                        <div key={step.key} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500
                                    ${i <= curIdx ? "bg-black dark:bg-white text-white dark:text-black" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400"}`}>
                                    {i < curIdx ? (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : i + 1}
                                </div>
                                {showExpanded && (
                                    <span className={`text-[9px] mt-1 ${i <= curIdx ? "text-black dark:text-white font-medium" : "text-neutral-400"}`}>
                                        {step.label}
                                    </span>
                                )}
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`h-0.5 flex-1 -mx-1 transition-all duration-500 ${i < curIdx ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"}`} />
                            )}
                        </div>
                    ))}
                </div>

                {showExpanded && routePlan && (
                    <div className="mt-4 space-y-3 border-t border-neutral-100 dark:border-neutral-700 pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                <div className="text-neutral-400">Distance</div>
                                <div className="font-semibold text-black dark:text-white">{routePlan.distanceKm} km</div>
                            </div>
                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                <div className="text-neutral-400">ETA</div>
                                <div className="font-semibold text-black dark:text-white">{routePlan.durationMinutes} min</div>
                            </div>
                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                <div className="text-neutral-400">Vehicle</div>
                                <div className="font-semibold text-black dark:text-white">{routePlan.vehicleRecommendation}</div>
                            </div>
                            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                <div className="text-neutral-400">Cost</div>
                                <div className="font-semibold text-black dark:text-white">Rs {routePlan.estimatedCost.min}-{routePlan.estimatedCost.max}</div>
                            </div>
                        </div>
                        {routePlan.fuelPlan && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                    <div className="text-neutral-400">Fuel Needed</div>
                                    <div className="font-semibold text-black dark:text-white">{routePlan.fuelPlan.estimatedFuelLiters} L</div>
                                </div>
                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                    <div className="text-neutral-400">Buffer</div>
                                    <div className="font-semibold text-black dark:text-white">{routePlan.fuelPlan.safetyBufferLiters} L</div>
                                </div>
                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                    <div className="text-neutral-400">Suggested</div>
                                    <div className="font-semibold text-black dark:text-white">{routePlan.fuelPlan.suggestedFuelLiters} L</div>
                                </div>
                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                    <div className="text-neutral-400">Fuel Cost</div>
                                    <div className="font-semibold text-black dark:text-white">Rs {routePlan.fuelPlan.estimatedFuelCost}</div>
                                </div>
                            </div>
                        )}
                        {routePlan.fuelStations && routePlan.fuelStations.length > 0 && (
                            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-2 text-xs">
                                <div className="font-semibold text-black dark:text-white mb-1">Fuel Stations on/near route</div>
                                <div className="space-y-1 text-neutral-600 dark:text-neutral-300">
                                    {routePlan.fuelStations.slice(0, 4).map((s, idx) => (
                                        <div key={`${s.lat}-${s.lng}-${idx}`}>{s.name}{s.brand ? ` (${s.brand})` : ""} / {s.distanceFromPickupKm ?? "-"} km</div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <MapView
                            pickup={routePlan.pickup}
                            dropoff={routePlan.dropoff}
                            routePath={routePlan.routePath}
                            checkpoints={routePlan.checkpoints}
                            height="200px"
                        />
                    </div>
                )}
            </div>

            {/* Bottom accent bar */}
            <div className={`h-1 transition-all duration-500
                ${req.status === "in_transit" ? "bg-black dark:bg-white" : req.status === "accepted" ? "bg-neutral-300 dark:bg-neutral-600" : "bg-neutral-100 dark:bg-neutral-800"}`} />
        </div>
    );
}

function DeliveryCard({
    req,
    actionLabel,
    onAction,
    isUpdating,
    expanded,
    onToggleExpand,
    aiAdvice,
    aiLoading,
    routePlan,
    routeLoading,
    onAskAI,
    onOptimizeRoute,
}: {
    req: DeliveryRequest;
    actionLabel?: string;
    onAction?: () => void;
    isUpdating?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
    aiAdvice?: string;
    aiLoading?: boolean;
    routePlan?: RouteOptimization;
    routeLoading?: boolean;
    onAskAI?: () => void;
    onOptimizeRoute?: () => void;
}) {
    const steps = ["pending", "accepted", "in_transit", "delivered"];
    const currentIndex = steps.indexOf(req.status);

    return (
        <div className={`bg-white dark:bg-neutral-900 rounded-2xl border transition-all duration-300 flex flex-col justify-between
            ${expanded ? "border-neutral-400 dark:border-neutral-500 shadow-md" : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm"}`}>
            <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold
                            ${req.status === "delivered" ? "bg-black dark:bg-white text-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"}`}>
                            {req.harvestId?.cropType?.charAt(0).toUpperCase() || "P"}
                        </div>
                        <div>
                            <h3 className="font-semibold text-black dark:text-white leading-tight">
                                {req.harvestId?.cropType || "Produce"}
                            </h3>
                            <p className="text-xs text-neutral-400">
                                {req.requesterId?.name || "Farmer"} / {timeAgo(req.createdAt)}
                            </p>
                            {req.requesterId?._id && (
                                <Link href={`/chat?userId=${req.requesterId._id}`} className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white underline-offset-2 hover:underline">
                                    Message requester
                                </Link>
                            )}
                        </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide ${statusStyles[req.status]}`}>
                        {req.status.replace("_", " ").toUpperCase()}
                    </span>
                </div>

                {/* Route visualization */}
                <div className="space-y-2 text-sm text-neutral-600">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2.5">
                            <div className="text-[10px] text-neutral-400 font-medium">FROM</div>
                            <div className="text-black dark:text-white text-sm font-medium truncate">{req.pickupLocation}</div>
                        </div>
                        <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2.5">
                            <div className="text-[10px] text-neutral-400 font-medium">TO</div>
                            <div className="text-black dark:text-white text-sm font-medium truncate">{req.dropoffLocation}</div>
                        </div>
                    </div>
                </div>

                {/* Expandable details */}
                <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[520px] opacity-100 mt-3" : "max-h-0 opacity-0"}`}>
                    <div className="space-y-2 text-sm pt-3 border-t border-neutral-100 dark:border-neutral-700">
                        {req.harvestId && (
                            <div className="flex justify-between">
                                <span className="text-neutral-400">Quantity</span>
                                <span className="font-medium text-black dark:text-white">{req.harvestId.quantity} kg</span>
                            </div>
                        )}
                        {req.harvestId?.location && (
                            <div className="flex justify-between">
                                <span className="text-neutral-400">Origin</span>
                                <span className="text-neutral-600">{req.harvestId.location}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-neutral-400">Requested</span>
                            <span className="text-neutral-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                        {routePlan && (
                            <>
                                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                        <div className="text-neutral-400">Distance / ETA</div>
                                        <div className="font-medium text-black dark:text-white">{routePlan.distanceKm} km / {routePlan.durationMinutes} min</div>
                                    </div>
                                    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                        <div className="text-neutral-400">Estimated Cost</div>
                                        <div className="font-medium text-black dark:text-white">Rs {routePlan.estimatedCost.min} - {routePlan.estimatedCost.max}</div>
                                    </div>
                                </div>
                                {routePlan.fuelPlan && (
                                    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                            <div className="text-neutral-400">Fuel</div>
                                            <div className="font-medium text-black dark:text-white">{routePlan.fuelPlan.estimatedFuelLiters}L + {routePlan.fuelPlan.safetyBufferLiters}L buffer</div>
                                        </div>
                                        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
                                            <div className="text-neutral-400">Estimated Fuel Cost</div>
                                            <div className="font-medium text-black dark:text-white">Rs {routePlan.fuelPlan.estimatedFuelCost}</div>
                                        </div>
                                    </div>
                                )}
                                {routePlan.fuelStations && routePlan.fuelStations.length > 0 && (
                                    <div className="mt-2 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2">
                                        <div className="text-[10px] text-neutral-400 mb-1">Nearby Fuel Stations</div>
                                        <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                                            {routePlan.fuelStations.slice(0, 3).map((s, idx) => (
                                                <div key={`${s.lat}-${s.lng}-${idx}`}>{s.name}{s.brand ? ` (${s.brand})` : ""} / {s.distanceFromPickupKm ?? "-"} km</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <MapView
                                    pickup={routePlan.pickup}
                                    dropoff={routePlan.dropoff}
                                    routePath={routePlan.routePath}
                                    checkpoints={routePlan.checkpoints}
                                    height="180px"
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* AI Route Advice */}
                {onAskAI && (
                    <div className="mt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                onClick={onAskAI}
                                disabled={aiLoading}
                                className="w-full text-left px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2"
                            >
                                {aiLoading ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-500 rounded-full animate-spin" />
                                        Analyzing route...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        AI Advice
                                    </>
                                )}
                            </button>
                            {onOptimizeRoute && (
                                <button
                                    onClick={onOptimizeRoute}
                                    disabled={routeLoading}
                                    className="w-full text-left px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-2"
                                >
                                    {routeLoading ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-neutral-400/30 border-t-neutral-700 dark:border-t-neutral-200 rounded-full animate-spin" />
                                            Optimizing...
                                        </>
                                    ) : "Optimize Route + Map"}
                                </button>
                            )}
                        </div>
                        {aiAdvice && (
                            <div className="mt-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                                <p className="text-xs text-amber-800 dark:text-amber-200 whitespace-pre-line leading-relaxed">{aiAdvice}</p>
                            </div>
                        )}
                        {routePlan?.strategy && (
                            <div className="mt-2 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                                <p className="text-xs text-neutral-700 dark:text-neutral-200 whitespace-pre-line leading-relaxed">{routePlan.strategy}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Progress bar */}
                <div className="mt-4 flex items-center gap-1">
                    {steps.map((_, i) => (
                        <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${i <= currentIndex ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"}`} />
                    ))}
                </div>
                <div className="flex justify-between mt-1.5 text-[9px] text-neutral-400">
                    <span>Pending</span>
                    <span>Accepted</span>
                    <span>In Transit</span>
                    <span>Delivered</span>
                </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-2">
                {actionLabel && onAction ? (
                    <Button className="flex-1 bg-black hover:bg-neutral-800 text-white rounded-full h-10 transition-all duration-200 hover:shadow-md"
                        onClick={onAction} disabled={isUpdating}>
                        {isUpdating ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Updating...
                            </span>
                        ) : actionLabel}
                    </Button>
                ) : null}
                {onToggleExpand && (
                    <button onClick={onToggleExpand}
                        className={`${actionLabel ? "w-10" : "w-full"} h-10 rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 flex items-center justify-center transition-all duration-200`}>
                        <svg className={`w-4 h-4 text-neutral-500 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
