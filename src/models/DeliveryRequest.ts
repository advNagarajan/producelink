import mongoose, { Schema, Document } from "mongoose";

export interface IDeliveryRequest extends Document {
    harvestId: mongoose.Types.ObjectId;
    requesterId: mongoose.Types.ObjectId; // Could be farmer or mandi owner
    pickupLocation: string;
    dropoffLocation: string;
    status: "pending" | "accepted" | "in_transit" | "delivered";
    transporterId?: mongoose.Types.ObjectId;
    createdAt: Date;
}

const DeliveryRequestSchema: Schema = new Schema(
    {
        harvestId: { type: Schema.Types.ObjectId, ref: "Harvest", required: true },
        requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        pickupLocation: { type: String, required: true },
        dropoffLocation: { type: String, required: true },
        status: {
            type: String,
            required: true,
            enum: ["pending", "accepted", "in_transit", "delivered"],
            default: "pending",
        },
        transporterId: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

export default mongoose.models.DeliveryRequest || mongoose.model<IDeliveryRequest>("DeliveryRequest", DeliveryRequestSchema);
