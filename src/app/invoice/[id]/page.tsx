"use client";

import { useState, useEffect, use } from "react";

interface Invoice {
    invoiceId: string;
    date: string;
    crop: string;
    quantity: number;
    price: number;
    total: number;
    farmer: { name: string; email: string; location?: string };
    buyer: { name: string; email: string; location?: string };
    transporter?: { name: string; email: string };
    status: string;
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch(`/api/invoice/${id}`)
            .then((r) => {
                if (!r.ok) throw new Error();
                return r.json();
            })
            .then(setInvoice)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    const handlePrint = () => window.print();

    if (loading) {
        return <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center text-neutral-400">Loading invoice...</div>;
    }

    if (error || !invoice) {
        return <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center text-neutral-400">Invoice not found</div>;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-2xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6 print:hidden">
                    <h1 className="text-2xl font-bold text-black dark:text-white">Invoice</h1>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
                    >
                        Print / Download
                    </button>
                </div>

                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-8 print:border-0 print:shadow-none print:p-0">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8 pb-6 border-b border-neutral-200 dark:border-neutral-700">
                        <div>
                            <div className="text-xl font-bold text-black dark:text-white tracking-tight">ProduceLink</div>
                            <div className="text-xs text-neutral-400 mt-1">Agricultural Marketplace</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-neutral-400">Invoice No.</div>
                            <div className="text-sm font-mono font-medium text-black dark:text-white">{invoice.invoiceId}</div>
                            <div className="text-xs text-neutral-400 mt-1">
                                {new Date(invoice.date).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}
                            </div>
                        </div>
                    </div>

                    {/* Parties */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <div className="text-xs text-neutral-400 font-medium mb-1">From (Farmer)</div>
                            <div className="text-sm font-medium text-black dark:text-white">{invoice.farmer.name}</div>
                            <div className="text-xs text-neutral-500">{invoice.farmer.email}</div>
                            {invoice.farmer.location && (
                                <div className="text-xs text-neutral-400">{invoice.farmer.location}</div>
                            )}
                        </div>
                        <div>
                            <div className="text-xs text-neutral-400 font-medium mb-1">To (Buyer)</div>
                            <div className="text-sm font-medium text-black dark:text-white">{invoice.buyer.name}</div>
                            <div className="text-xs text-neutral-500">{invoice.buyer.email}</div>
                            {invoice.buyer.location && (
                                <div className="text-xs text-neutral-400">{invoice.buyer.location}</div>
                            )}
                        </div>
                    </div>

                    {/* Line items */}
                    <table className="w-full text-sm mb-8">
                        <thead>
                            <tr className="border-b border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500">
                                <th className="text-left py-2 font-medium">Item</th>
                                <th className="text-right py-2 font-medium">Qty (kg)</th>
                                <th className="text-right py-2 font-medium">Price/kg</th>
                                <th className="text-right py-2 font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-neutral-100 dark:border-neutral-800">
                                <td className="py-3 text-black dark:text-white font-medium">{invoice.crop}</td>
                                <td className="py-3 text-right">{invoice.quantity}</td>
                                <td className="py-3 text-right">₹{invoice.price}</td>
                                <td className="py-3 text-right font-medium text-black dark:text-white">₹{invoice.total.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Total */}
                    <div className="flex justify-end mb-8">
                        <div className="w-48">
                            <div className="flex justify-between py-2 text-sm">
                                <span className="text-neutral-500">Subtotal</span>
                                <span className="text-black dark:text-white">₹{invoice.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-2 text-sm border-t border-neutral-200 dark:border-neutral-700 font-bold">
                                <span className="text-black dark:text-white">Total</span>
                                <span className="text-black dark:text-white">₹{invoice.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Transporter */}
                    {invoice.transporter && (
                        <div className="pt-6 border-t border-neutral-200 dark:border-neutral-700">
                            <div className="text-xs text-neutral-400 font-medium mb-1">Transported by</div>
                            <div className="text-sm text-black dark:text-white">{invoice.transporter.name}</div>
                            <div className="text-xs text-neutral-500">{invoice.transporter.email}</div>
                        </div>
                    )}

                    {/* Status */}
                    <div className="mt-6 flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium
                            ${invoice.status === "delivered" ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white" : "bg-neutral-50 dark:bg-neutral-800 text-neutral-500"}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
