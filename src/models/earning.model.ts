import type { Types } from "mongoose";
import mongoose from "mongoose";

interface Earning {
  userId: Types.ObjectId;
  travelId: Types.ObjectId;
  consignmentId: Types.ObjectId;
  amount: number;
  status: "pending" | "completed" | "failed";
  is_withdrawn: boolean;
  withdrawnAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const earningSchema = new mongoose.Schema<Earning>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    travelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Travel",
      required: true,
    },
    consignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consignment",
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      required: true,
    },
    is_withdrawn: { type: Boolean, default: false },
    withdrawnAt: { type: Date },
  },
  { timestamps: true }
);

const Earning = mongoose.model<Earning>("Earnings", earningSchema);

export default Earning;
