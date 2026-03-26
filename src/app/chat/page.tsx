"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";

interface Conversation {
    userId: string;
    userName: string;
    lastMessage: string;
    lastTime: string;
    unread: number;
}

interface Message {
    _id: string;
    fromUser: string;
    toUser: string;
    body: string;
    createdAt: string;
}

function formatTime(d: string) {
    return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: string) {
    const dt = new Date(d);
    const today = new Date();
    if (dt.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dt.toDateString() === yesterday.toDateString()) return "Yesterday";
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPage() {
    const { user, loading: authLoading } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        fetch("/api/chat/conversations")
            .then((r) => r.json())
            .then(setConversations)
            .catch(() => {});
    }, []);

    const loadMessages = async (userId: string) => {
        setSelected(userId);
        try {
            const res = await fetch(`/api/chat/messages/${userId}`);
            if (res.ok) setMessages(await res.json());
        } catch { /* ignore */ }
        setConversations((cs) =>
            cs.map((c) => (c.userId === userId ? { ...c, unread: 0 } : c))
        );
    };

    useEffect(() => {
        if (selected) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = setInterval(() => {
                fetch(`/api/chat/messages/${selected}`)
                    .then((r) => r.json())
                    .then(setMessages)
                    .catch(() => {});
            }, 5000);
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [selected]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !selected) return;
        setSending(true);
        try {
            const res = await fetch("/api/chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toUser: selected, body: input.trim() }),
            });
            if (res.ok) {
                const msg = await res.json();
                setMessages((prev) => [...prev, msg]);
                setInput("");
            }
        } catch { /* ignore */ }
        setSending(false);
    };

    if (authLoading) {
        return <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center text-neutral-400">Loading...</div>;
    }

    if (!user) {
        return <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center text-neutral-400">Please log in to access messages</div>;
    }

    const selectedUser = conversations.find((c) => c.userId === selected);

    return (
        <AppShell>
            <div className="max-w-5xl mx-auto px-6 md:px-8 py-8">
                <h1 className="text-2xl font-bold text-black dark:text-white mb-6">Messages</h1>

                <div className="flex border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden h-[600px]">
                    {/* Sidebar */}
                    <div className="w-72 border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="p-6 text-center text-sm text-neutral-400">No conversations yet</div>
                        ) : (
                            conversations.map((c) => (
                                <button
                                    key={c.userId}
                                    onClick={() => loadMessages(c.userId)}
                                    className={`w-full text-left px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors
                                        ${selected === c.userId ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm text-black dark:text-white truncate">{c.userName}</span>
                                        <span className="text-[10px] text-neutral-400">{formatDate(c.lastTime)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-neutral-500 truncate max-w-[160px]">{c.lastMessage}</span>
                                        {c.unread > 0 && (
                                            <span className="w-5 h-5 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                                                {c.unread}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Chat area */}
                    <div className="flex-1 flex flex-col">
                        {!selected ? (
                            <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
                                Select a conversation
                            </div>
                        ) : (
                            <>
                                <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                                    <div className="font-semibold text-sm text-black dark:text-white">
                                        {selectedUser?.userName || "User"}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                    {messages.map((m) => {
                                        const mine = m.fromUser === user.id;
                                        return (
                                            <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                                <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm
                                                    ${mine
                                                        ? "bg-black text-white dark:bg-white dark:text-black rounded-br-md"
                                                        : "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white rounded-bl-md"}`}
                                                >
                                                    <div>{m.body}</div>
                                                    <div className={`text-[10px] mt-1 ${mine ? "text-neutral-400" : "text-neutral-500"}`}>
                                                        {formatTime(m.createdAt)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={bottomRef} />
                                </div>

                                <form onSubmit={send} className="p-4 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex gap-2">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm text-black dark:text-white border-0 outline-none placeholder:text-neutral-400"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending || !input.trim()}
                                        className="w-9 h-9 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-40"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
