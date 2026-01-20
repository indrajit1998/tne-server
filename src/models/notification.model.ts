import mongoose, { Schema, type Types } from "mongoose";

interface Notification {
  userId: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  relatedConsignmentId?: Types.ObjectId;
  requestId?: Types.ObjectId;
  relatedTravelId?: Types.ObjectId;
  relatedPaymentId?: Types.ObjectId;
  typeOfNotif?: "consignment" | "travel" | "general";
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<Notification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    relatedConsignmentId: { type: Schema.Types.ObjectId, ref: "Consignment" },
    requestId: { type: Schema.Types.ObjectId, ref: "CarryRequest" },
    relatedTravelId: { type: Schema.Types.ObjectId, ref: "Travel" },
    relatedPaymentId: { type: Schema.Types.ObjectId, ref: "Payments" },
    typeOfNotif: {
      type: String,
      enum: ["consignment", "travel", "general"],
      default: "general",
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model<Notification>(
  "Notifications",
  notificationSchema
);

export default Notification;
