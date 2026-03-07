import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketplacePage() {
    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Shared Nav */}
            <header className="px-6 lg:px-8 h-16 flex items-center border-b bg-white dark:bg-slate-900 justify-between">
                <Link href="/" className="flex items-center font-bold text-2xl text-green-600">
                    <svg className="h-7 w-7 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                    </svg>
                    ProduceLink
                </Link>
                <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
                    <Link className="text-sm font-medium text-green-600 font-semibold" href="/marketplace">Marketplace</Link>
                    <Link className="text-sm font-medium hover:text-green-600 transition-colors" href="/#about">About Us</Link>
                    <div className="flex items-center gap-2 ml-4">
                        <Button variant="outline" asChild>
                            <Link href="/login">Login</Link>
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" asChild>
                            <Link href="/register">Sign Up</Link>
                        </Button>
                    </div>
                </nav>
            </header>

            <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-extrabold mb-3">Live Marketplace</h1>
                    <p className="text-slate-500 max-w-xl mx-auto">
                        Browse produce listed by farmers across India. Sign up as a Mandi Owner to place bids in real-time.
                    </p>
                </div>

                {/* CTA Banner */}
                <div className="bg-green-600 text-white rounded-2xl p-8 mb-10 flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">Ready to start bidding?</h2>
                        <p className="text-green-100">Create a free account to access live auctions and place bids.</p>
                    </div>
                    <Button className="bg-white text-green-700 hover:bg-green-50 font-semibold" asChild>
                        <Link href="/register">Get Started — It&apos;s Free</Link>
                    </Button>
                </div>

                {/* How It Works Cards */}
                <h2 className="text-2xl font-bold mb-6">How the bidding works</h2>
                <div className="grid gap-6 md:grid-cols-3 mb-12">
                    {[
                        { step: "01", title: "Farmer lists a harvest", desc: "Crop type, weight, quality grade, and a base price. AI insights help them price fairly.", icon: "🌾" },
                        { step: "02", title: "Mandi owners bid", desc: "Any registered mandi owner can place a bid above the base price. Every bid is visible to the farmer instantly.", icon: "🏷️" },
                        { step: "03", title: "Farmer accepts best bid", desc: "The farmer reviews all bids and accepts the highest. Transport is then arranged through the platform.", icon: "✅" },
                    ].map((item) => (
                        <div key={item.step} className="bg-white dark:bg-slate-900 rounded-xl p-6 border shadow-sm">
                            <div className="text-4xl mb-3">{item.icon}</div>
                            <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Step {item.step}</div>
                            <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                            <p className="text-slate-500 text-sm">{item.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Sample listings (static demo) */}
                <h2 className="text-2xl font-bold mb-6">Sample Listings</h2>
                <p className="text-slate-500 mb-4 text-sm">These are demo listings. <Link href="/register" className="text-green-600 hover:underline">Log in</Link> to see live data and place real bids.</p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[
                        { crop: "Tomatoes", farmer: "Ravi Kumar", location: "Nashik, MH", qty: 500, grade: "A", price: 18 },
                        { crop: "Wheat", farmer: "Gurpreet Singh", location: "Ludhiana, PB", qty: 2000, grade: "B", price: 22 },
                        { crop: "Onions", farmer: "Suresh Patil", location: "Solapur, MH", qty: 800, grade: "A", price: 15 },
                        { crop: "Potatoes", farmer: "Rajesh Yadav", location: "Agra, UP", qty: 1200, grade: "B", price: 12 },
                        { crop: "Green Chillies", farmer: "Lakshmi Devi", location: "Guntur, AP", qty: 300, grade: "A", price: 40 },
                        { crop: "Mangoes", farmer: "Abdul Rehman", location: "Ratnagiri, MH", qty: 400, grade: "A", price: 60 },
                    ].map((item) => (
                        <div key={item.crop + item.farmer} className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-5 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-green-700">{item.crop}</h3>
                                        <p className="text-xs text-slate-400">{item.location}</p>
                                    </div>
                                    <span className="bg-green-50 text-green-700 font-bold text-sm px-2 py-1 rounded-lg">₹{item.price}/kg</span>
                                </div>
                                <div className="space-y-1 text-sm text-slate-600">
                                    <div className="flex justify-between"><span>Farmer:</span><span className="font-medium">{item.farmer}</span></div>
                                    <div className="flex justify-between"><span>Quantity:</span><span className="font-medium">{item.qty} kg</span></div>
                                    <div className="flex justify-between"><span>Grade:</span><span className="font-medium text-amber-600">Grade {item.grade}</span></div>
                                </div>
                            </div>
                            <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white" asChild>
                                <Link href="/register">Sign up to Bid</Link>
                            </Button>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="border-t py-6 text-center text-sm text-slate-500 mt-8">
                © 2026 ProduceLink. Built for farmers, by builders.
            </footer>
        </div>
    );
}
