import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import DeliveryRequest from "@/models/DeliveryRequest";

export const dynamic = "force-dynamic";

// PATCH: Transporter accepts or updates a delivery request status
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user?.role !== "transporter") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { status } = await req.json();
        const validStatuses = ["accepted", "in_transit", "delivered"];

        if (!validStatuses.includes(status)) {
            return NextResponse.json({ message: "Invalid status" }, { status: 400 });
        }

        await dbConnect();

        const request = await DeliveryRequest.findById(id);
        if (!request) {
            return NextResponse.json({ message: "Request not found" }, { status: 404 });
        }

        // Security: If already accepted, only the assigned transporter can update it further
        if (request.status !== "pending" && request.transporterId?.toString() !== session.user.id) {
            return NextResponse.json({ message: "This request is already assigned to someone else" }, { status: 403 });
        }

        request.status = status;
        if (status === "accepted") {
            request.transporterId = session.user.id as any;
        }
        await request.save();

        return NextResponse.json(request, { status: 200 });
    } catch (error: any) {
        console.error("Error updating delivery request:", error);
        return NextResponse.json({ message: "Failed to update request" }, { status: 500 });
    }
}
