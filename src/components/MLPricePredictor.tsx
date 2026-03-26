"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface MLPrediction {
    prediction: {
        suggestedPrice: number;
        suggestedMin: number;
        suggestedMax: number;
        unit: string;
    };
    confidence: {
        level: string;
        score: number;
        basedOnSamples: number;
    };
    factors: Array<{
        factor: string;
        impact: number;
        detail: string;
    }>;
    model: {
        type: string;
        r2Score: number;
        mae: number;
        trainedOn: number;
        trainedAt: string | null;
    };
    cropStats: {
        min?: number;
        max?: number;
        mean?: number;
        count?: number;
    };
    govtReference?: {
        state: string;
        minPricePerKg: number | null;
        enforced: boolean;
    };
    input: {
        cropType: string;
        location: string;
        state: string;
        quantity: number;
        qualityGrade: string;
        month: number;
        monthName: string;
    };
}

interface Props {
    cropType: string;
    location: string;
    quantity?: number;
    qualityGrade?: string;
    onPriceSelect?: (price: number) => void;
}

const confidenceColors: Record<string, { bar: string; text: string; bg: string }> = {
    high: { bar: "bg-green-500", text: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
    medium: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
    low: { bar: "bg-red-500", text: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
};

export default function MLPricePredictor({ cropType, location, quantity = 100, qualityGrade = "A", onPriceSelect }: Props) {
    const [prediction, setPrediction] = useState<MLPrediction | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(false);

    const fetchPrediction = async () => {
        if (!cropType || !location) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/predict/ml", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cropType, location, quantity, qualityGrade }),
            });
            if (res.ok) {
                const data = await res.json();
                setPrediction(data);
                setExpanded(true);
            } else {
                const data = await res.json();
                setError(data.detail || data.message || "Prediction failed");
            }
        } catch {
            setError("Could not reach ML prediction service");
        } finally {
            setLoading(false);
        }
    };

    if (!prediction) {
        return (
            <div className="space-y-1">
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-neutral-300 dark:border-neutral-600 text-xs px-3 h-8 gap-1.5"
                    onClick={fetchPrediction}
                    disabled={loading || !cropType || !location}
                >
                    {loading ? (
                        <>
                            <span className="w-3 h-3 border-2 border-neutral-300 border-t-black dark:border-t-white rounded-full animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            ML Price Estimate
                        </>
                    )}
                </Button>
                {error && <div className="text-red-600 text-xs">{error}</div>}
            </div>
        );
    }

    const { prediction: pred, confidence, factors, model, cropStats, input, govtReference } = prediction;
    const conf = confidenceColors[confidence.level] || confidenceColors.medium;
    const priceRange = pred.suggestedMax - pred.suggestedMin;

    return (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-black dark:bg-white flex items-center justify-center">
                        <svg className="w-4 h-4 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-semibold text-black dark:text-white">
                            Rs {pred.suggestedMin} — Rs {pred.suggestedMax}
                            <span className="text-neutral-400 font-normal ml-1">/ kg</span>
                        </div>
                        <div className="text-[10px] text-neutral-500">
                            ML Predicted • {confidence.level} confidence
                        </div>
                    </div>
                </div>
                <svg className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-4 py-4 space-y-4">
                    {/* Suggested price + range visualization */}
                    <div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-black dark:text-white">Rs {pred.suggestedPrice}</span>
                            <span className="text-sm text-neutral-400">suggested / kg</span>
                        </div>
                        {/* Range bar */}
                        <div className="relative pt-1">
                            <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                                <span>Rs {pred.suggestedMin}</span>
                                <span>Rs {pred.suggestedMax}</span>
                            </div>
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full relative overflow-hidden">
                                <div
                                    className="absolute inset-y-0 bg-gradient-to-r from-neutral-300 via-black to-neutral-300 dark:from-neutral-600 dark:via-white dark:to-neutral-600 rounded-full"
                                    style={{ left: "10%", right: "10%" }}
                                />
                                {/* Suggested price marker */}
                                {priceRange > 0 && (
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-black dark:bg-white rounded-full border-2 border-white dark:border-black shadow-lg z-10"
                                        style={{
                                            left: `${Math.max(5, Math.min(95, ((pred.suggestedPrice - pred.suggestedMin) / priceRange) * 80 + 10))}%`,
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                        {cropStats?.mean && (
                            <div className="text-[10px] text-neutral-400 mt-2">
                                Historical avg: Rs {cropStats.mean} | Range: Rs {cropStats.min} — Rs {cropStats.max} ({cropStats.count} past listings)
                            </div>
                        )}
                    </div>

                    {/* Confidence meter */}
                    <div className={`p-3 rounded-xl ${conf.bg}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-semibold ${conf.text}`}>
                                {confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)} Confidence
                            </span>
                            <span className={`text-xs ${conf.text}`}>{(confidence.score * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${conf.bar}`} style={{ width: `${confidence.score * 100}%` }} />
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-1">
                            Based on {confidence.basedOnSamples} historical transactions for {input.cropType}
                        </div>
                    </div>

                    {/* Government benchmark */}
                    {govtReference?.enforced && govtReference.minPricePerKg !== null && (
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">Government Reference Applied</div>
                            <div className="text-xs text-blue-700/90 dark:text-blue-200 mt-1">
                                {govtReference.state}: Min Rs {govtReference.minPricePerKg}/kg. Suggested prices are kept at or above this floor.
                            </div>
                        </div>
                    )}

                    {/* Influencing factors */}
                    {factors.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Price Factors</h4>
                            <div className="space-y-1.5">
                                {factors.map((f, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-16 text-right">
                                            <span className="text-[10px] font-mono text-neutral-400">{f.impact.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: `${Math.min(100, f.impact * 3)}%` }} />
                                            </div>
                                        </div>
                                        <div className="flex-[2] min-w-0">
                                            <div className="text-xs font-medium text-black dark:text-white truncate">{f.factor}</div>
                                            <div className="text-[10px] text-neutral-400 truncate">{f.detail}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Model info */}
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] text-neutral-400">
                            {model.type} • R²={model.r2Score} • MAE=Rs {model.mae} • {model.trainedOn} samples
                        </div>
                        {onPriceSelect && (
                            <Button
                                type="button"
                                className="h-7 text-xs rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200"
                                onClick={() => onPriceSelect(pred.suggestedPrice)}
                            >
                                Use Rs {pred.suggestedPrice}
                            </Button>
                        )}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchPrediction}
                        disabled={loading}
                        className="text-[10px] text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                        {loading ? "Reanalyzing..." : "Refresh prediction"}
                    </button>
                </div>
            )}
        </div>
    );
}
