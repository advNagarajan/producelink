import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Bid from "@/models/Bid";
import Harvest from "@/models/Harvest";
import { broadcastBid } from "@/lib/firebaseUtils";

export const dynamic = "force-dynamic";

// GET bids for a specific harvest (used by farmer to see incoming bids)
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const harvestId = searchParams.get("harvestId");

        if (!harvestId) {
            return NextResponse.json({ message: "harvestId is required" }, { status: 400 });
        }

        await dbConnect();
        const bids = await Bid.find({ harvestId })
            .populate("mandiOwnerId", "name email")
            .sort({ amount: -1 }); // highest first

        return NextResponse.json(bids, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching bids:", error);
        return NextResponse.json({ message: "Failed to fetch bids" }, { status: 500 });
    }
}

// POST a new bid (mandi owner)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "mandi_owner") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { harvestId, amount } = await req.json();

        if (!harvestId || !amount) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        await dbConnect();

        // Verify the harvest exists and is still accepting bids
        const harvest = await Harvest.findById(harvestId);
        if (!harvest) {
            return NextResponse.json({ message: "Harvest not found" }, { status: 404 });
        }

        if (harvest.status === "sold") {
            return NextResponse.json({ message: "This harvest has already been sold" }, { status: 400 });
        }

        if (amount <= harvest.basePrice) {
            return NextResponse.json({ message: "Bid amount must be greater than the base price" }, { status: 400 });
        }

        // Save bid to MongoDB
        const newBid = await Bid.create({
            harvestId,
            mandiOwnerId: session.user.id,
            amount,
            status: "pending",
        });

        // Update harvest status if it was just "available"
        if (harvest.status === "available") {
            harvest.status = "bidding";
            await harvest.save();
        }

        // Broadcast the new bid to Firebase so all clients see it instantly
        await broadcastBid(harvestId, {
            bidId: newBid._id.toString(),
            amount,
            mandiOwnerName: session.user.name || "A Mandi Owner", // We'd realistically populate this differently, but keeping it simple
            mandiOwnerId: session.user.id
        });

        return NextResponse.json(newBid, { status: 201 });
    } catch (error: any) {
        console.error("Error creating bid:", error);
        return NextResponse.json({ message: "Failed to place bid" }, { status: 500 });
    }
}
