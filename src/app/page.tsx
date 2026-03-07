import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Navigation */}
      <header className="px-6 lg:px-8 h-16 flex items-center border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 justify-between">
        <Link className="flex items-center justify-center font-semibold text-xl tracking-tight text-black" href="/">
          ProduceLink
        </Link>
        <nav className="ml-auto flex gap-6 items-center">
          <Link className="text-sm font-medium text-neutral-600 hover:text-black transition-colors" href="/marketplace">
            Marketplace
          </Link>
          <Link className="text-sm font-medium text-neutral-600 hover:text-black transition-colors" href="#how-it-works">
            How It Works
          </Link>
          <Link className="text-sm font-medium text-neutral-600 hover:text-black transition-colors" href="#about">
            About
          </Link>
          <div className="flex items-center gap-3 ml-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center text-sm font-medium text-black border border-neutral-300 rounded-full px-4 h-9 hover:bg-neutral-50 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center text-sm font-medium bg-black text-white rounded-full px-4 h-9 hover:bg-neutral-800 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="w-full py-24 md:py-32 lg:py-44">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-black leading-[1.08]">
              Fair prices for farmers.
              <br />
              <span className="text-neutral-400">Transparent markets for all.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed">
              ProduceLink connects farmers directly to mandi owners through competitive bidding.
              No intermediaries. No exploitation. Just fair, transparent trade.
            </p>
            <div className="flex items-center justify-center gap-4 mt-10">
              <Button className="bg-black hover:bg-neutral-800 text-white px-8 h-12 text-base rounded-full" asChild>
                <Link href="/register">Start Trading</Link>
              </Button>
              <Button variant="outline" className="px-8 h-12 text-base rounded-full border-neutral-300 text-black hover:bg-neutral-50" asChild>
                <Link href="/marketplace">View Marketplace</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="w-full py-24 border-t border-neutral-200">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black">How ProduceLink Works</h2>
              <p className="mt-4 text-neutral-500 text-lg max-w-xl mx-auto">Three simple steps to better prices and efficient logistics.</p>
            </div>
            <div className="grid gap-12 md:grid-cols-3">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-5">
                  <span className="text-lg font-bold text-black">1</span>
                </div>
                <h3 className="text-lg font-semibold text-black mb-2">Farmers List Harvests</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">Enter crop type, quantity, quality grade, and set a base price. AI-powered insights help determine fair market value.</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-5">
                  <span className="text-lg font-bold text-black">2</span>
                </div>
                <h3 className="text-lg font-semibold text-black mb-2">Mandi Owners Bid</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">Browse available produce and place competitive bids. Real-time updates ensure complete transparency in every transaction.</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-5">
                  <span className="text-lg font-bold text-black">3</span>
                </div>
                <h3 className="text-lg font-semibold text-black mb-2">Transporters Deliver</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">Accepted bids automatically generate transport requests. Transporters pick up and deliver produce efficiently.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="w-full py-24 bg-neutral-50 border-t border-neutral-200">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black">Built for Every Stakeholder</h2>
              <p className="mt-4 text-neutral-500 text-lg max-w-xl mx-auto">Whether you grow, trade, or transport — ProduceLink has you covered.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="bg-white rounded-2xl p-8 border border-neutral-200">
                <h3 className="text-lg font-semibold text-black mb-3">For Farmers</h3>
                <ul className="space-y-3 text-sm text-neutral-600">
                  <li>List harvests with detailed crop information</li>
                  <li>Get AI-powered pricing recommendations</li>
                  <li>Review and accept the best bids</li>
                </ul>
              </div>
              <div className="bg-white rounded-2xl p-8 border border-neutral-200">
                <h3 className="text-lg font-semibold text-black mb-3">For Mandi Owners</h3>
                <ul className="space-y-3 text-sm text-neutral-600">
                  <li>Browse live marketplace listings</li>
                  <li>Place competitive bids in real time</li>
                  <li>Track bid status and outcomes</li>
                </ul>
              </div>
              <div className="bg-white rounded-2xl p-8 border border-neutral-200">
                <h3 className="text-lg font-semibold text-black mb-3">For Transporters</h3>
                <ul className="space-y-3 text-sm text-neutral-600">
                  <li>View available delivery requests</li>
                  <li>Accept and manage transport jobs</li>
                  <li>Update delivery status in real time</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="w-full py-24 border-t border-neutral-200">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black mb-6">About ProduceLink</h2>
            <p className="text-neutral-500 text-lg leading-relaxed mb-6">
              In India, farmers often receive lower profits due to limited access to competitive markets,
              price exploitation, and inefficient post-harvest logistics. ProduceLink addresses these
              challenges by creating a transparent, technology-driven marketplace.
            </p>
            <p className="text-neutral-500 text-lg leading-relaxed">
              Our platform introduces competitive bidding, optional verification systems, buyer feedback,
              and integrated transport coordination — all designed to increase farmer profitability,
              reduce wastage, and create a more equitable agricultural ecosystem.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-24 bg-black text-white">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Ready to join?</h2>
            <p className="text-neutral-400 text-lg mb-8">Create a free account and start trading today.</p>
            <Button className="bg-white text-black hover:bg-neutral-200 px-8 h-12 text-base rounded-full font-medium" asChild>
              <Link href="/register">Create Your Account</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-400">
        2026 ProduceLink. Built for farmers, by builders.
      </footer>
    </div>
  );
}
