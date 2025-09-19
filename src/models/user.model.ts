import mongoose, { Schema } from "mongoose";
interface User {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  razorpayCustomerId?: string;
  profilePictureUrl?: string;
}

const UserSchema = new Schema<User>(
  {
    phoneNumber: { type: String, required: true, unique: true },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    email: { type: String, required: false,sparse:true },
    onboardingCompleted: { type: Boolean, default: false },
    profilePictureUrl: { type: String, required: false },
    isVerified: { type: Boolean, default: false },
    razorpayCustomerId: { type: String, required: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<User>("User", UserSchema);
