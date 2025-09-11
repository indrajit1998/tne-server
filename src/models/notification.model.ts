import mongoose, { Schema, type Types } from "mongoose";

interface Notification {
  userId: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  relatedConsignmentId?: Types.ObjectId;
  relatedTravelId?: Types.ObjectId;
  relatedPaymentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<Notification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    relatedConsignmentId: { type: Schema.Types.ObjectId, ref: "Consignments" },
    relatedTravelId: { type: Schema.Types.ObjectId, ref: "Travels" },
    relatedPaymentId: { type: Schema.Types.ObjectId, ref: "Payments" },
  },
  { timestamps: true }
);

const Notification = mongoose.model<Notification>(
  "Notifications",
  notificationSchema
);

export default Notification;
