import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Harvest from "@/models/Harvest";

export const dynamic = "force-dynamic";

// GET all harvests for the logged-in farmer
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "farmer") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();
        const harvests = await Harvest.find({ farmerId: session.user.id }).sort({ createdAt: -1 });

        return NextResponse.json(harvests, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching harvests:", error);
        return NextResponse.json({ message: "Failed to fetch harvests" }, { status: 500 });
    }
}

// POST a new harvest entry
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "farmer") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { cropType, quantity, qualityGrade, basePrice, location } = await req.json();

        if (!cropType || !quantity || !qualityGrade || !basePrice || !location) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        await dbConnect();

        const newHarvest = await Harvest.create({
            farmerId: session.user.id,
            cropType,
            quantity,
            qualityGrade,
            basePrice,
            location,
            status: "available",
        });

        return NextResponse.json(newHarvest, { status: 201 });
    } catch (error: any) {
        console.error("Error creating harvest:", error);
        return NextResponse.json({ message: "Failed to create harvest entry" }, { status: 500 });
    }
}
