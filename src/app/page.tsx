import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="px-6 lg:px-8 h-16 flex items-center border-b bg-white dark:bg-slate-900 justify-between">
        <Link className="flex items-center justify-center font-bold text-2xl text-green-600 dark:text-green-500" href="#">
          <span className="sr-only">ProduceLink</span>
          <svg
            className="h-8 w-8 mr-2"
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
          ProduceLink
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-green-600 transition-colors" href="#">
            Marketplace
          </Link>
          <Link className="text-sm font-medium hover:text-green-600 transition-colors" href="#">
            About Us
          </Link>
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
      <main className="flex-1 flex items-center justify-center -mt-16">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2 max-w-3xl">
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                  Empowering Farmers, <br/>
                  <span className="text-green-600 dark:text-green-500">Connecting Markets.</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-slate-500 md:text-xl dark:text-slate-400 pt-4">
                  ProduceLink is the modern bidding platform connecting farmers directly to Mandi owners and transporters.
                  Fair prices, transparent bidding, and AI-powered market insights.
                </p>
              </div>
              <div className="space-x-4 pt-8">
                <Button className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg rounded-full" asChild>
                  <Link href="/register">Get Started Now</Link>
                </Button>
                <Button variant="outline" className="px-8 py-6 text-lg rounded-full" asChild>
                    <Link href="/marketplace">View Live Markets</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
