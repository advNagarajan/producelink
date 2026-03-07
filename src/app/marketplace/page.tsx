import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketplacePage() {
    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Navigation */}
            <header className="px-6 lg:px-8 h-16 flex items-center border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 justify-between">
                <Link href="/" className="font-semibold text-xl tracking-tight text-black">
                    ProduceLink
                </Link>
                <nav className="ml-auto flex gap-6 items-center">
                    <Link className="text-sm font-medium text-black" href="/marketplace">Marketplace</Link>
                    <Link className="text-sm font-medium text-neutral-600 hover:text-black transition-colors" href="/#about">About</Link>
                    <div className="flex items-center gap-3 ml-4">
                        <Button variant="outline" className="rounded-full border-neutral-300 text-black hover:bg-neutral-50" asChild>
                            <Link href="/login">Sign In</Link>
                        </Button>
                        <Button className="bg-black hover:bg-neutral-800 text-white rounded-full" asChild>
                            <Link href="/register">Get Started</Link>
                        </Button>
                    </div>
                </nav>
            </header>

            <main className="flex-1 max-w-5xl mx-auto px-6 py-16 w-full">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-black mb-3">Marketplace</h1>
                    <p className="text-neutral-500 max-w-xl mx-auto">
                        Browse produce listed by farmers across India. Sign up as a Mandi Owner to place bids in real time.
                    </p>
                </div>

                {/* CTA Banner */}
                <div className="bg-black text-white rounded-2xl p-8 mb-12 flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">Ready to start bidding?</h2>
                        <p className="text-neutral-400">Create a free account to access live auctions and place bids.</p>
                    </div>
                    <Button className="bg-white text-black hover:bg-neutral-200 font-medium rounded-full px-6" asChild>
                        <Link href="/register">Get Started</Link>
                    </Button>
                </div>

                {/* How bidding works */}
                <h2 className="text-2xl font-bold text-black mb-6">How the bidding works</h2>
                <div className="grid gap-6 md:grid-cols-3 mb-14">
                    {[
                        { step: "01", title: "Farmer lists a harvest", desc: "Crop type, weight, quality grade, and a base price. AI insights help them price fairly." },
                        { step: "02", title: "Mandi owners bid", desc: "Any registered mandi owner can place a bid above the base price. Every bid is visible to the farmer instantly." },
                        { step: "03", title: "Farmer accepts best bid", desc: "The farmer reviews all bids and accepts the highest. Transport is then arranged through the platform." },
                    ].map((item) => (
                        <div key={item.step} className="bg-white rounded-2xl p-6 border border-neutral-200">
                            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                                <span className="text-sm font-bold text-black">{item.step}</span>
                            </div>
                            <h3 className="font-semibold text-lg text-black mb-2">{item.title}</h3>
                            <p className="text-neutral-500 text-sm">{item.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Sample listings */}
                <h2 className="text-2xl font-bold text-black mb-4">Sample Listings</h2>
                <p className="text-neutral-500 mb-6 text-sm">These are demo listings. <Link href="/register" className="text-black hover:underline font-medium">Log in</Link> to see live data and place real bids.</p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[
                        { crop: "Tomatoes", farmer: "Ravi Kumar", location: "Nashik, MH", qty: 500, grade: "A", price: 18 },
                        { crop: "Wheat", farmer: "Gurpreet Singh", location: "Ludhiana, PB", qty: 2000, grade: "B", price: 22 },
                        { crop: "Onions", farmer: "Suresh Patil", location: "Solapur, MH", qty: 800, grade: "A", price: 15 },
                        { crop: "Potatoes", farmer: "Rajesh Yadav", location: "Agra, UP", qty: 1200, grade: "B", price: 12 },
                        { crop: "Green Chillies", farmer: "Lakshmi Devi", location: "Guntur, AP", qty: 300, grade: "A", price: 40 },
                        { crop: "Mangoes", farmer: "Abdul Rehman", location: "Ratnagiri, MH", qty: 400, grade: "A", price: 60 },
                    ].map((item) => (
                        <div key={item.crop + item.farmer} className="bg-white rounded-2xl border border-neutral-200 p-5 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold text-lg text-black">{item.crop}</h3>
                                        <p className="text-xs text-neutral-400">{item.location}</p>
                                    </div>
                                    <span className="bg-neutral-100 text-black font-semibold text-sm px-2.5 py-1 rounded-full">{item.price}/kg</span>
                                </div>
                                <div className="space-y-1.5 text-sm text-neutral-600">
                                    <div className="flex justify-between"><span>Farmer</span><span className="font-medium text-black">{item.farmer}</span></div>
                                    <div className="flex justify-between"><span>Quantity</span><span className="font-medium text-black">{item.qty} kg</span></div>
                                    <div className="flex justify-between"><span>Grade</span><span className="font-medium text-black">Grade {item.grade}</span></div>
                                </div>
                            </div>
                            <Button className="w-full mt-4 bg-black hover:bg-neutral-800 text-white rounded-full h-10" asChild>
                                <Link href="/register">Sign Up to Bid</Link>
                            </Button>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-400 mt-8">
                2026 ProduceLink. Built for farmers, by builders.
            </footer>
        </div>
    );
}
