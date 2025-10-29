import mongoose, { Document, Schema } from "mongoose";

export interface KYCSubDocument {
  requestId?: string;
  status: "pending" | "verified" | "failed" | "not_provided";
}

export interface KYC {
  groupId?: string;
  ind_pan: KYCSubDocument;
  ind_aadhaar: KYCSubDocument;
  ind_driving_license: KYCSubDocument;
  face: KYCSubDocument;
  overallStatus: "pending" | "verified" | "failed" | "not_started";
  updatedAt?: Date;
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string; // masked version (e.g., ****1234)
  accountNumberEncrypted?: string; // full encrypted number (not stored in schema)
  ifscCode: string;
  bankName: string;
  branch: string;
  accountHash: string; // SHA-256 hash for uniqueness
  razorpayFundAccountId?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends Document {
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

  // Traveller stats
  rating: number;
  reviewCount: number;
  totalEarnings: number;
  completedTrips: number;

  // Bank details (embedded subdocument)
  bankDetails?: BankDetails;

  // KYC info
  kyc: KYC;
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

    kyc: {
      type: {
        groupId: { type: String },
        ind_pan: {
          requestId: { type: String },
          status: {
            type: String,
            enum: ["pending", "verified", "failed", "not_provided"],
            default: "not_provided",
          },
        },
        ind_aadhaar: {
          requestId: { type: String },
          status: {
            type: String,
            enum: ["pending", "verified", "failed", "not_provided"],
            default: "not_provided",
          },
        },
        ind_driving_license: {
          requestId: { type: String },
          status: {
            type: String,
            enum: ["pending", "verified", "failed", "not_provided"],
            default: "not_provided",
          },
        },
        face: {
          requestId: { type: String },
          status: {
            type: String,
            enum: ["pending", "verified", "failed", "not_provided"],
            default: "not_provided",
          },
        },
        overallStatus: {
          type: String,
          enum: ["pending", "verified", "failed", "not_started"],
          default: "not_started",
        },
        updatedAt: { type: Date },
      },
      default: {},
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<User>("User", UserSchema);
