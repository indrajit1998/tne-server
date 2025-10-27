import mongoose, { Document, Schema, Types } from "mongoose";

export interface PayoutT {
  userId: Types.ObjectId;
  travelId?: Types.ObjectId;
  consignmentId?: Types.ObjectId;
  amount: number;
  status: "pending" | "completed" | "failed";
  razorpayPayoutId: string;
  razorpayPaymentId?: string;
  failureReason?: string;
  clientPayoutId: string;
  earningIds: Types.ObjectId[];
  notes?: any;
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
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      required: true,
    },
    razorpayPaymentId: { type: String },
    failureReason: { type: String },
    notes: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Payout = mongoose.model<PayoutDoc>("Payout", payoutSchema);
