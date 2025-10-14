import mongoose, { Schema, type Types } from "mongoose";

interface TravelConsignments {
  consignmentId: Types.ObjectId;
  travelId: Types.ObjectId;
  senderOTP: string;
  receiverOTP: string;
  status: "to_handover" | "in_transit" | "delivered" | "cancelled";
  travellerEarning: number;
  senderToPay: number;
  platformCommission: number;
  createdAt: Date;
  updatedAt: Date;
  pickupTime?: Date;
  deliveryTime?: Date;
}

const travelConsignmentsSchema = new Schema<TravelConsignments>(
  {
    consignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Consignment",
      required: true,
    },
    travelId: { type: Schema.Types.ObjectId, ref: "Travel", required: true },
    senderOTP: { type: String, required: true },
    receiverOTP: { type: String, required: true },
    status: {
      type: String,
      enum: ["to_handover", "in_transit", "delivered", "cancelled"],
      default: "to_handover",
      required: true,
    },
    travellerEarning: { type: Number, required: true },
    senderToPay: { type: Number, required: true },
    platformCommission: { type: Number, required: true },
    pickupTime: { type: Date },
    deliveryTime: { type: Date },
  },
  { timestamps: true }
);

const TravelConsignments = mongoose.model<TravelConsignments>(
  "TravelConsignments",
  travelConsignmentsSchema
);

export default TravelConsignments;
