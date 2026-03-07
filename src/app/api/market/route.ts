import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Harvest from "@/models/Harvest";

export const dynamic = "force-dynamic";

// GET all available harvests across all farmers
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "mandi_owner") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();
        // Fetch only harvests that are available or currently in bidding
        const availableHarvests = await Harvest.find({
            status: { $in: ["available", "bidding"] }
        })
            .populate("farmerId", "name") // Assuming we want to show the farmer's name
            .sort({ createdAt: -1 });

        return NextResponse.json(availableHarvests, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching market harvests:", error);
        return NextResponse.json({ message: "Failed to fetch market data" }, { status: 500 });
    }
}
