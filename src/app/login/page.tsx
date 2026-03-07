"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isRegistered = searchParams.get("registered") === "true";
    const { refresh } = useAuth();

    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email, password: formData.password }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.message || "Invalid credentials");
            } else {
                await refresh();
                router.push("/dashboard");
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-white p-4">
            <div className="w-full max-w-md space-y-8 p-8">
                <div className="text-center">
                    <Link href="/" className="inline-block mb-6 text-black font-semibold text-xl tracking-tight">
                        ProduceLink
                    </Link>
                    <h2 className="text-3xl font-bold tracking-tight text-black">
                        Welcome back
                    </h2>
                    <p className="mt-2 text-sm text-neutral-500">
                        Enter your credentials to continue.
                    </p>
                </div>

                {isRegistered && (
                    <div className="bg-neutral-50 text-black p-3 rounded-lg text-sm border border-neutral-200">
                        Registration successful. Please sign in.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    {error && <div className="text-red-600 text-sm font-medium">{error}</div>}

                    <Button type="submit" className="w-full bg-black hover:bg-neutral-800 text-white h-11 rounded-full text-sm" disabled={loading}>
                        {loading ? "Signing in..." : "Sign In"}
                    </Button>

                    <p className="text-center text-sm text-neutral-500 mt-4">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-black hover:underline font-medium">
                            Sign up
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default function Login() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
