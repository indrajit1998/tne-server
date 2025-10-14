import mongoose, { Schema } from "mongoose";

interface User {
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  razorpayCustomerId?: string;
  profilePictureUrl?: string;
  isAdmin: boolean;
  rating?: number;
  reviewCount?: number;
  totalEarnings?: number;
  completedTrips?: number;
}

const UserSchema = new Schema<User>(
  {
    phoneNumber: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, sparse: true },
    onboardingCompleted: { type: Boolean, default: false },
    profilePictureUrl: { type: String },
    isVerified: { type: Boolean, default: false },
    razorpayCustomerId: { type: String },
    isAdmin: { type: Boolean, default: false },

    // ⭐ Traveller Stats
    rating: { type: Number, default: 0 }, // Average rating (1–5)
    reviewCount: { type: Number, default: 0 }, // Number of reviews
    totalEarnings: { type: Number, default: 0 }, // Total ₹ earned from deliveries
    completedTrips: { type: Number, default: 0 }, // Number of successful carries
  },
  { timestamps: true }
);

export const User = mongoose.model<User>("User", UserSchema);
