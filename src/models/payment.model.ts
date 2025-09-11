import mongoose, { Schema, type Types } from "mongoose";

interface Payment {
  userId: Types.ObjectId;
  consignmentId: Types.ObjectId;
  travelId: Types.ObjectId;
  type: "sender_pay" | "traveller_earning" | "platform_commission";
  amount: number;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
}

const paymentSchema = new Schema<Payment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    consignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Consignments",
      required: true,
    },
    travelId: { type: Schema.Types.ObjectId, ref: "Travels", required: true },
    type: {
      type: String,
      enum: ["sender_pay", "traveller_earning", "platform_commission"],
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      required: true,
    },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
  },
  { timestamps: true }
);

const Payment = mongoose.model<Payment>("Payments", paymentSchema);

export default Payment;
