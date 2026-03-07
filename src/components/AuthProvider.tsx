"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => {},
    refresh: async () => {},
});

export function useAuth() {
    return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me");
            if (res.ok) {
                setUser(await res.json());
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const logout = useCallback(async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        router.push("/");
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, loading, logout, refresh: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
}
