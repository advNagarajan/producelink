"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import Link from "next/link";

export default function Register() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "farmer",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                router.push("/login?registered=true");
            } else {
                const data = await res.json();
                setError(data.message || "Registration failed");
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
                        Create an account
                    </h2>
                    <p className="mt-2 text-sm text-neutral-500">
                        Join ProduceLink today.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

                        <div className="space-y-2">
                            <Label htmlFor="role">I am a</Label>
                            <select
                                id="role"
                                name="role"
                                className="flex h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black focus:ring-1 focus:ring-black"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="farmer">Farmer</option>
                                <option value="mandi_owner">Mandi Owner</option>
                                <option value="transporter">Transporter</option>
                            </select>
                        </div>
                    </div>

                    {error && <div className="text-red-600 text-sm font-medium">{error}</div>}

                    <Button type="submit" className="w-full bg-black hover:bg-neutral-800 text-white h-11 rounded-full text-sm" disabled={loading}>
                        {loading ? "Creating account..." : "Create Account"}
                    </Button>

                    <p className="text-center text-sm text-neutral-500 mt-4">
                        Already have an account?{" "}
                        <Link href="/login" className="text-black hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
