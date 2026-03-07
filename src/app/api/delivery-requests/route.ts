import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import DeliveryRequest from "@/models/DeliveryRequest";

export const dynamic = "force-dynamic";

// GET: Transporters see all pending requests / Farmers see their own requests
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        let requests;
        if (session.user?.role === "transporter") {
            // Transporters see all pending requests OR requests assigned to them
            requests = await DeliveryRequest.find({
                $or: [
                    { status: "pending" },
                    { transporterId: session.user.id }
                ]
            })
                .populate("harvestId", "cropType quantity location")
                .populate("requesterId", "name")
                .sort({ createdAt: -1 });
        } else {
            // Farmers/Mandi owners see their own requests
            requests = await DeliveryRequest.find({ requesterId: session.user.id })
                .populate("harvestId", "cropType quantity location")
                .populate("transporterId", "name")
                .sort({ createdAt: -1 });
        }

        return NextResponse.json(requests, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching delivery requests:", error);
        return NextResponse.json({ message: "Failed to fetch delivery requests" }, { status: 500 });
    }
}

// POST: Create a new delivery request (Farmer or Mandi Owner)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user?.role === "transporter") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { harvestId, pickupLocation, dropoffLocation } = await req.json();

        if (!harvestId || !pickupLocation || !dropoffLocation) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        await dbConnect();

        const newRequest = await DeliveryRequest.create({
            harvestId,
            requesterId: session.user.id,
            pickupLocation,
            dropoffLocation,
            status: "pending",
        });

        return NextResponse.json(newRequest, { status: 201 });
    } catch (error: any) {
        console.error("Error creating delivery request:", error);
        return NextResponse.json({ message: "Failed to create delivery request" }, { status: 500 });
    }
}
