import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    role: "farmer" | "mandi_owner" | "transporter";
    createdAt: Date;
    updatedAt: Date;
    // Specific role fields
    farmLocation?: string;
    businessName?: string;
    vehicleType?: string;
}

const UserSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, select: false },
        role: {
            type: String,
            required: true,
            enum: ["farmer", "mandi_owner", "transporter"]
        },
        farmLocation: { type: String },
        businessName: { type: String },
        vehicleType: { type: String },
    },
    { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
