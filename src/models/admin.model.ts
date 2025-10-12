import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

interface Admin{
    name: string;
    role: 'superadmin' | 'support' | 'manager';
    email: string; 
    password: string;
    phoneNumber?: string;
}

const AdminSchema = new Schema<Admin>({
    name: { type: String, required: true },
    role:{ type: String, enum: ['superadmin', 'support', 'manager'], default: 'support' },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, required: false },
})

AdminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
})

export const AdminModel = mongoose.model<Admin>("Admin", AdminSchema);