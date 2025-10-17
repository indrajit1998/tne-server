import mongoose, { Schema, type Types } from "mongoose";

interface CarryRequest {
  consignmentId: Types.ObjectId;
  travellerId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  travelId: Types.ObjectId;
  status:
    | "pending"
    | "accepted_pending_payment"
    | "accepted"
    | "rejected"
    | "expired";

  senderPayAmount: number; // total the sender has to pay
  travellerEarning: number; // what traveller will earn
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
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    travelId: {
      type: Schema.Types.ObjectId,
      ref: "Travel",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "accepted_pending_payment",
        "rejected",
        "expired",
      ],
      default: "pending",
      required: true,
    },
    senderPayAmount: { type: Number, required: true },
    travellerEarning: { type: Number, required: true },
  },
  { timestamps: true }
);

export const CarryRequest = mongoose.model<CarryRequest>(
  "CarryRequest",
  carryRequestSchema
);
