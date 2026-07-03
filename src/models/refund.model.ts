import mongoose, { Document, Schema, Types } from "mongoose";

export interface RefundT {
  userId: Types.ObjectId; // User receiving the refund (usually Sender)
  paymentId: Types.ObjectId; // Original Payment ID
  consignmentId?: Types.ObjectId; // Associated Consignment
  amount: number;
  status: "pending" | "initiated" | "processed" | "rejected";
  refundId?: string; // Generated manual refund ID
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Document type
export type RefundDoc = Document & RefundT;

const refundSchema = new Schema<RefundDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
    consignmentId: { type: Schema.Types.ObjectId, ref: "Consignment" },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "initiated", "processed", "rejected"],
      default: "pending",
      required: true,
    },
    refundId: { type: String, unique: true }, // rfnd_manual_timestamp
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Refund = mongoose.model<RefundDoc>("Refund", refundSchema);
