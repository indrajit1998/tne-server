import mongoose, { Schema, type Types } from "mongoose";

interface PayoutAccounts {
  userId: Types.ObjectId;
  razorpayContactId: string;
  razorpayFundAccountId: string;
  createdAt: Date;
  updatedAt: Date;
  displayName?: string;
  accountType?: "bank_account" | "vpa";
  bankName?: string;
  branch?: string;
  accountNumber?: string; // masked for frontend
  vpa?: string; // masked for frontend
  accountHash?: string; // SHA-256 hash for duplicate check
}

const payoutAccountsSchema = new Schema<PayoutAccounts>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    razorpayContactId: { type: String, required: true },
    razorpayFundAccountId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    displayName: { type: String },
    accountType: { type: String, enum: ["bank_account", "vpa"] },
    bankName: { type: String }, // optional for VPA
    branch: { type: String }, // optional for VPA
    accountNumber: { type: String }, // masked for frontend
    accountHash: { type: String, required: true, unique: true }, // hash for uniqueness
    vpa: { type: String }, // masked for frontend
  },
  { timestamps: true }
);

const PayoutAccountsModel = mongoose.model<PayoutAccounts>(
  "PayoutAccounts",
  payoutAccountsSchema
);

export default PayoutAccountsModel;
