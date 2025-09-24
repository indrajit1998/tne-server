import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

interface Admin{
    email: string; 
    password: string;
}

const AdminSchema = new Schema<Admin>({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
})

AdminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
})

export const AdminModel = mongoose.model<Admin>("Admin", AdminSchema);