import mongoose, { Document, Schema, Types } from "mongoose";

export interface PayoutT {
  userId: Types.ObjectId;
  travelId?: Types.ObjectId;
  consignmentId?: Types.ObjectId;
  amount: number;
  status: "pending" | "initiated" | "paid" | "rejected";
  razorpayPayoutId?: string;
  razorpayPaymentId?: string;
  failureReason?: string;
  clientPayoutId: string;
  earningIds: Types.ObjectId[];
  notes?: any;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Document type
export type PayoutDoc = Document & PayoutT;

const payoutSchema = new Schema<PayoutDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    travelId: { type: Schema.Types.ObjectId, ref: "Travel" },
    consignmentId: { type: Schema.Types.ObjectId, ref: "Consignment" },
    amount: { type: Number, required: true },
    clientPayoutId: {
      type: String,
      required: true,
      unique: true,
    },
    earningIds: [{ type: Schema.Types.ObjectId, ref: "Earning" }],
    status: {
      type: String,
      enum: ["pending", "initiated", "paid", "rejected"],
      default: "pending",
      required: true,
    },
    razorpayPaymentId: { type: String },
    failureReason: { type: String },
    notes: { type: Schema.Types.Mixed },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Payout = mongoose.model<PayoutDoc>("Payout", payoutSchema);
