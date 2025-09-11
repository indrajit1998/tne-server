import mongoose, { Schema, type Types } from "mongoose";

interface CarryRequest {
  consignmentId: Types.ObjectId;
  travellerId: Types.ObjectId;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: Date;
  updatedAt: Date;
}

const carryRequestSchema = new Schema<CarryRequest>(
  {
    consignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Consignment",
      required: true,
    },
    travellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true }
);

export const CarryRequest = mongoose.model<CarryRequest>(
  "CarryRequest",
  carryRequestSchema
);
