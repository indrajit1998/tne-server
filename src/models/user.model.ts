import mongoose, { Schema } from "mongoose";

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string; //masked
  ifscCode: string;
  bankName: string;
  branch: string;
  accountHash: string; // SHA-256 hash
  razorpayFundAccountId?: string; //link to the fundAccount
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  isKYCVerified: boolean;
  razorpayCustomerId?: string;
  profilePictureUrl?: string;
  isAdmin: boolean;
  rating?: number;
  reviewCount?: number;
  totalEarnings?: number;
  completedTrips?: number;

  bankDetails?: BankDetails;
}

const BankDetailsSchema = new Schema<BankDetails>(
  {
    accountHolderName: { type: String, required: true },
    accountNumber: { type: String, required: true }, // masked like "****1234"
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    branch: { type: String, required: true },
    accountHash: { type: String, required: true, unique: true },
    razorpayFundAccountId: { type: String },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true, _id: false }
);

const UserSchema = new Schema<User>(
  {
    phoneNumber: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, sparse: true },
    onboardingCompleted: { type: Boolean, default: false },
    profilePictureUrl: { type: String },
    isVerified: { type: Boolean, default: false },
    isKYCVerified: { type: Boolean, default: false },
    razorpayCustomerId: { type: String },
    isAdmin: { type: Boolean, default: false },

    // Traveller Stats
    rating: { type: Number, default: 0 }, // Average rating (1–5)
    reviewCount: { type: Number, default: 0 }, // Number of reviews
    totalEarnings: { type: Number, default: 0 }, // Total ₹ earned from deliveries
    completedTrips: { type: Number, default: 0 }, // Number of successful carries

    // Bank Details
    bankDetails: { type: BankDetailsSchema },
  },
  { timestamps: true }
);

export const User = mongoose.model<User>("User", UserSchema);
