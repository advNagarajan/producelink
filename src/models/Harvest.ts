import mongoose, { Schema, Document } from "mongoose";

export interface IHarvest extends Document {
    farmerId: mongoose.Types.ObjectId;
    cropType: string;
    quantity: number; // in kg or tonnes
    qualityGrade: "A" | "B" | "C";
    basePrice: number;
    location: string;
    status: "available" | "bidding" | "sold";
    createdAt: Date;
    updatedAt: Date;
}

const HarvestSchema: Schema = new Schema(
    {
        farmerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        cropType: { type: String, required: true },
        quantity: { type: Number, required: true },
        qualityGrade: {
            type: String,
            required: true,
            enum: ["A", "B", "C"]
        },
        basePrice: { type: Number, required: true },
        location: { type: String, required: true },
        status: {
            type: String,
            required: true,
            enum: ["available", "bidding", "sold"],
            default: "available",
        },
    },
    { timestamps: true }
);

export default mongoose.models.Harvest || mongoose.model<IHarvest>("Harvest", HarvestSchema);
