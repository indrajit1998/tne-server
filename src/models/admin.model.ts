import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

interface Admin{
    firstName: string;
    lastName: string;
    role: 'superadmin' | 'support' | 'manager';
    email: string; 
    password: string;
}

const AdminSchema = new Schema<Admin>({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role:{ type: String, enum: ['superadmin', 'support', 'manager'], default: 'support' },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
})

AdminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
})

export const AdminModel = mongoose.model<Admin>("Admin", AdminSchema);