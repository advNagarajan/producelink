import mongoose, { Schema, Document } from "mongoose";

export interface IBid extends Document {
    harvestId: mongoose.Types.ObjectId;
    mandiOwnerId: mongoose.Types.ObjectId;
    amount: number;
    status: "pending" | "accepted" | "rejected";
    createdAt: Date;
}

const BidSchema: Schema = new Schema(
    {
        harvestId: { type: Schema.Types.ObjectId, ref: "Harvest", required: true },
        mandiOwnerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        amount: { type: Number, required: true },
        status: {
            type: String,
            required: true,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true }
);

export default mongoose.models.Bid || mongoose.model<IBid>("Bid", BidSchema);
