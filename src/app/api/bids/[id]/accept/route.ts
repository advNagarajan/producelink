import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Bid from "@/models/Bid";
import Harvest from "@/models/Harvest";
import DeliveryRequest from "@/models/DeliveryRequest";

export const dynamic = "force-dynamic";

// POST /api/bids/[id]/accept — farmer accepts a specific bid
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user?.role !== "farmer") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        // Find the bid
        const bid = await Bid.findById(id).populate("harvestId");
        if (!bid) {
            return NextResponse.json({ message: "Bid not found" }, { status: 404 });
        }

        const harvest = await Harvest.findById(bid.harvestId);
        if (!harvest) {
            return NextResponse.json({ message: "Harvest not found" }, { status: 404 });
        }

        // Ensure the farmer owns this harvest
        if (harvest.farmerId.toString() !== session.user.id) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        // Mark this bid as accepted
        bid.status = "accepted";
        await bid.save();

        // Reject all other bids for the same harvest
        await Bid.updateMany(
            { harvestId: harvest._id, _id: { $ne: bid._id } },
            { status: "rejected" }
        );

        // Mark harvest as sold
        harvest.status = "sold";
        await harvest.save();

        // Auto-create a delivery request
        const deliveryRequest = await DeliveryRequest.create({
            harvestId: harvest._id,
            requesterId: session.user.id,
            pickupLocation: harvest.location,
            dropoffLocation: bid.dropoffLocation,
            status: "pending",
        });

        return NextResponse.json({ bid, deliveryRequest }, { status: 200 });
    } catch (error: any) {
        console.error("Error accepting bid:", error);
        return NextResponse.json({ message: "Failed to accept bid" }, { status: 500 });
    }
}
