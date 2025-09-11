import mongoose, { Schema, type Types } from "mongoose";

interface PayoutAccounts {
  userId: Types.ObjectId;
  razorpayContactId: string;
  razorpayFundAccountId: string;
  createdAt: Date;
  updatedAt: Date;
  displayName?: string;
  accountType?: "bank_account" | "vpa";
}

const payoutAccountsSchema = new Schema<PayoutAccounts>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    razorpayContactId: { type: String, required: true },
    razorpayFundAccountId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    displayName: { type: String },
    accountType: { type: String, enum: ["bank_account", "vpa"] },
  },
  { timestamps: true }
);

const PayoutAccountsModel = mongoose.model<PayoutAccounts>(
  "PayoutAccounts",
  payoutAccountsSchema
);

export default PayoutAccountsModel;
