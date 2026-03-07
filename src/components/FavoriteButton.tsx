"use client";

import { useState, useEffect } from "react";

export default function FavoriteButton({ targetId }: { targetId: string }) {
    const [favorited, setFavorited] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/favorites/check/${targetId}`)
            .then((r) => r.json())
            .then((d) => setFavorited(d.favorited))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [targetId]);

    const toggle = async () => {
        setFavorited(!favorited);
        try {
            const res = await fetch(`/api/favorites/${targetId}`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setFavorited(data.favorited);
            }
        } catch {
            setFavorited(favorited);
        }
    };

    if (loading) return null;

    return (
        <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="transition-transform hover:scale-110"
            title={favorited ? "Remove from favorites" : "Add to favorites"}
        >
            <svg
                className={`w-5 h-5 transition-colors ${favorited ? "text-black dark:text-white fill-current" : "text-neutral-300 dark:text-neutral-600"}`}
                fill={favorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
        </button>
    );
}
