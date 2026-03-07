"use client";

import { useState } from "react";

interface HarvestRow {
    crop: string;
    quantity: string;
    price: string;
    location: string;
}

const emptyRow = (): HarvestRow => ({ crop: "", quantity: "", price: "", location: "" });

export default function BulkHarvestForm({ onSuccess }: { onSuccess?: () => void }) {
    const [rows, setRows] = useState<HarvestRow[]>([emptyRow(), emptyRow(), emptyRow()]);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const updateRow = (idx: number, field: keyof HarvestRow, value: string) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);

    const removeRow = (idx: number) => {
        if (rows.length <= 1) return;
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setResult(null);

        const valid = rows.filter(
            (r) => r.crop.trim() && Number(r.quantity) > 0 && Number(r.price) > 0
        );

        if (valid.length === 0) {
            setResult({ ok: false, msg: "Add at least one valid harvest" });
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/harvests/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    harvests: valid.map((r) => ({
                        crop: r.crop.trim(),
                        quantity: Number(r.quantity),
                        price: Number(r.price),
                        location: r.location.trim() || undefined,
                    })),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setResult({ ok: true, msg: `${data.insertedCount} harvests listed successfully` });
                setRows([emptyRow(), emptyRow(), emptyRow()]);
                onSuccess?.();
            } else {
                const data = await res.json().catch(() => ({}));
                setResult({ ok: false, msg: data.detail || "Failed to submit" });
            }
        } catch {
            setResult({ ok: false, msg: "Network error" });
        }
        setSubmitting(false);
    };

    return (
        <form onSubmit={submit}>
            <div className="space-y-3">
                {/* Header */}
                <div className="hidden sm:grid grid-cols-[1fr_100px_100px_1fr_36px] gap-2 text-xs text-neutral-400 font-medium px-1">
                    <span>Crop</span>
                    <span>Qty (kg)</span>
                    <span>Price/kg</span>
                    <span>Location</span>
                    <span></span>
                </div>

                {rows.map((row, i) => (
                    <div key={i} className="grid sm:grid-cols-[1fr_100px_100px_1fr_36px] gap-2 items-center">
                        <input
                            type="text"
                            placeholder="Crop name"
                            value={row.crop}
                            onChange={(e) => updateRow(i, "crop", e.target.value)}
                            className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm text-black dark:text-white border-0 outline-none placeholder:text-neutral-400"
                        />
                        <input
                            type="number"
                            placeholder="Qty"
                            min="0"
                            value={row.quantity}
                            onChange={(e) => updateRow(i, "quantity", e.target.value)}
                            className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm text-black dark:text-white border-0 outline-none placeholder:text-neutral-400"
                        />
                        <input
                            type="number"
                            placeholder="₹/kg"
                            min="0"
                            value={row.price}
                            onChange={(e) => updateRow(i, "price", e.target.value)}
                            className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm text-black dark:text-white border-0 outline-none placeholder:text-neutral-400"
                        />
                        <input
                            type="text"
                            placeholder="Location"
                            value={row.location}
                            onChange={(e) => updateRow(i, "location", e.target.value)}
                            className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm text-black dark:text-white border-0 outline-none placeholder:text-neutral-400"
                        />
                        <button
                            type="button"
                            onClick={() => removeRow(i)}
                            disabled={rows.length <= 1}
                            className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3 mt-4">
                <button
                    type="button"
                    onClick={addRow}
                    className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                    + Add Row
                </button>
                <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                    {submitting ? "Submitting..." : "List All"}
                </button>
            </div>

            {result && (
                <div className={`mt-3 text-sm ${result.ok ? "text-green-600" : "text-red-500"}`}>
                    {result.msg}
                </div>
            )}
        </form>
    );
}
