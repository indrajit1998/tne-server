import mongoose, { Schema, type Types } from "mongoose";

interface Payment {
  userId: Types.ObjectId;
  consignmentId: Types.ObjectId;
  travelId: Types.ObjectId;
  type: "sender_pay" | "traveller_earning" | "platform_commission";
  amount: number;
  status:
    | "pending"
    | "completed_pending_webhook"
    | "completed"
    | "failed"
    | "cancelled";
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
}

const paymentSchema = new Schema<Payment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Consignment",
      required: true,
    },
    travelId: { type: Schema.Types.ObjectId, ref: "Travel", required: true },
    type: {
      type: String,
      enum: ["sender_pay", "traveller_earning", "platform_commission"],
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "completed_pending_webhook",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "pending",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      // Set default to 20 minutes from now
      default: () => new Date(Date.now() + 20 * 60 * 1000),
    },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
  },
  { timestamps: true }
);

const Payment = mongoose.model<Payment>("Payments", paymentSchema);

export default Payment;
