"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

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

const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-blue-100 text-blue-800",
    in_transit: "bg-orange-100 text-orange-800",
    delivered: "bg-green-100 text-green-800",
};

const nextStatus: Record<string, string> = {
    accepted: "in_transit",
    in_transit: "delivered",
};

const nextStatusLabel: Record<string, string> = {
    accepted: "Mark In Transit",
    in_transit: "Mark Delivered",
};

export default function TransporterDashboard() {
    const [requests, setRequests] = useState<DeliveryRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    const fetchRequests = async () => {
        try {
            const res = await fetch("/api/delivery-requests");
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (err) {
            console.error("Failed to fetch requests", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleUpdateStatus = async (id: string, status: string) => {
        setUpdating(id);
        try {
            const res = await fetch(`/api/delivery-requests/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                fetchRequests();
            }
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setUpdating(null);
        }
    };

    const pending = requests.filter((r) => r.status === "pending");
    const active = requests.filter((r) => ["accepted", "in_transit"].includes(r.status));
    const completed = requests.filter((r) => r.status === "delivered");

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        Transporter Dashboard
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">
                        Find delivery requests and manage your routes.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={fetchRequests}>
                        🔄 Refresh
                    </Button>
                    <div className="flex gap-4 text-center">
                        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border shadow-sm">
                            <div className="text-2xl font-bold text-yellow-600">{pending.length}</div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Available</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border shadow-sm">
                            <div className="text-2xl font-bold text-blue-600">{active.length}</div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Active</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border shadow-sm">
                            <div className="text-2xl font-bold text-green-600">{completed.length}</div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Done</div>
                        </div>
                    </div>
                    <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}>
                        Sign Out
                    </Button>
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Available Requests */}
                    <section>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-yellow-400 inline-block animate-pulse"></span>
                            Available Requests ({pending.length})
                        </h2>
                        {pending.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-dashed text-center text-slate-500">
                                No pending requests right now. Check back soon!
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pending.map((req) => (
                                    <DeliveryCard
                                        key={req._id}
                                        req={req}
                                        actionLabel="Accept Request"
                                        actionClass="bg-blue-600 hover:bg-blue-700"
                                        onAction={() => handleUpdateStatus(req._id, "accepted")}
                                        isUpdating={updating === req._id}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                    {/* ... rest of the file ... */}

                    {/* Active Deliveries */}
                    {active.length > 0 && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-blue-400 inline-block"></span>
                                My Active Deliveries ({active.length})
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {active.map((req) => (
                                    <DeliveryCard
                                        key={req._id}
                                        req={req}
                                        actionLabel={nextStatusLabel[req.status]}
                                        actionClass={req.status === "accepted" ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"}
                                        onAction={() => handleUpdateStatus(req._id, nextStatus[req.status])}
                                        isUpdating={updating === req._id}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Completed */}
                    {completed.length > 0 && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-green-400 inline-block"></span>
                                Completed ({completed.length})
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {completed.map((req) => (
                                    <DeliveryCard key={req._id} req={req} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

function DeliveryCard({
    req,
    actionLabel,
    actionClass,
    onAction,
    isUpdating,
}: {
    req: DeliveryRequest;
    actionLabel?: string;
    actionClass?: string;
    onAction?: () => void;
    isUpdating?: boolean;
}) {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                            {req.harvestId?.cropType || "Produce"}
                        </h3>
                        <p className="text-sm text-slate-500">
                            By: {req.requesterId?.name || "Farmer"}
                        </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[req.status]}`}>
                        {req.status.replace("_", " ").toUpperCase()}
                    </span>
                </div>

                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex gap-2 items-start">
                        <span className="text-green-500 font-bold shrink-0">↑ FROM</span>
                        <span>{req.pickupLocation}</span>
                    </div>
                    <div className="flex gap-2 items-start">
                        <span className="text-red-500 font-bold shrink-0">↓ TO</span>
                        <span>{req.dropoffLocation}</span>
                    </div>
                    {req.harvestId && (
                        <div className="flex justify-between pt-2 border-t mt-2">
                            <span className="text-slate-400">Qty:</span>
                            <span className="font-medium">{req.harvestId.quantity} kg</span>
                        </div>
                    )}
                </div>
            </div>

            {actionLabel && onAction && (
                <Button
                    className={`w-full mt-4 text-white ${actionClass}`}
                    onClick={onAction}
                    disabled={isUpdating}
                >
                    {isUpdating ? "Updating..." : actionLabel}
                </Button>
            )}
        </div>
    );
}
