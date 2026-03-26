"use client";

import { useEffect, useState } from "react";

interface AssistantMessage {
    role: "user" | "assistant";
    text: string;
    createdAt: string;
}

export default function AIOpsAssistant({
    title = "AI Operations Assistant",
    subtitle = "Ask about your orders, bids, deliveries, and business status.",
}: {
    title?: string;
    subtitle?: string;
}) {
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch("/api/predict/user-assistant/history?limit=20")
            .then((r) => (r.ok ? r.json() : { messages: [] }))
            .then((data) => setMessages(Array.isArray(data.messages) ? data.messages : []))
            .catch(() => setMessages([]));
    }, []);

    const askAssistant = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = question.trim();
        if (!q) return;

        const optimisticUserMsg: AssistantMessage = {
            role: "user",
            text: q,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUserMsg]);
        setQuestion("");
        setLoading(true);

        try {
            const res = await fetch("/api/predict/user-assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: q }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Assistant unavailable");
            }

            const data = await res.json();
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: String(data.answer || "No response generated."),
                    createdAt: new Date().toISOString(),
                },
            ]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: err instanceof Error ? err.message : "Assistant unavailable right now",
                    createdAt: new Date().toISOString(),
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-1rem)] rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur p-3 shadow-xl">
            <div className="mb-3">
                <div className="text-sm font-semibold text-black dark:text-white">{title}</div>
                <div className="text-[11px] text-neutral-500">{subtitle}</div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {messages.length === 0 && (
                    <div className="text-xs text-neutral-400">
                        No assistant messages yet. Try: "What should I focus on today?"
                    </div>
                )}
                {messages.slice(-6).map((m, idx) => (
                    <div key={`${m.createdAt}-${idx}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-line leading-relaxed ${
                                m.role === "user"
                                    ? "bg-black text-white dark:bg-white dark:text-black"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white"
                            }`}
                        >
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={askAssistant} className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about orders, bids, deliveries..."
                    className="flex-1 px-3 py-2 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 outline-none text-black dark:text-white"
                />
                <button
                    type="submit"
                    disabled={loading || !question.trim()}
                    className="px-3 py-2 rounded-full text-xs font-medium bg-black dark:bg-white text-white dark:text-black disabled:opacity-50"
                >
                    {loading ? "Thinking..." : "Ask AI"}
                </button>
            </form>
        </div>
    );
}
