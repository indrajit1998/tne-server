import mongoose, { Schema, type Types } from "mongoose";
interface RefundDetails {
  refundId?: string | null;
  amount?: number | null;
  speed?: string | null;
  status?: string | null;
}
interface Payment {
  userId: Types.ObjectId;
  consignmentId: Types.ObjectId;
  travelId: Types.ObjectId;
  // carryRequestId: Types.ObjectId;
  type: "sender_pay" | "traveller_earning" | "platform_commission";
  amount: number;
  status:
    | "pending"
    | "completed_pending_webhook"
    | "completed"
    | "failed"
    | "refunded"
    | "cancelled";
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  refundDetails: RefundDetails;
}

const paymentSchema = new Schema<Payment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type !== "platform_commission"; // Not required for platform
      },
    },
    consignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Consignment",
      required: true,
    },
    travelId: { type: Schema.Types.ObjectId, ref: "Travel", required: true },
    // carryRequestId: {
    //   type: Schema.Types.ObjectId,
    //   ref: "CarryRequest",
    //   required: true,
    // },
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
        "refunded",
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
    refundDetails: {
      refundId: { type: String, default: null },
      amount: { type: Number, default: null },
      speed: { type: String, default: null },
      status: { type: String, default: null },
    },
  },
  { timestamps: true }
);

// Add index for efficient queries
paymentSchema.index({ carryRequestId: 1, status: 1 });

const Payment = mongoose.model<Payment>("Payments", paymentSchema);

export default Payment;
