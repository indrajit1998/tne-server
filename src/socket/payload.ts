import type { Types } from "mongoose";

export interface CarryRequestPayload {
  requestId: Types.ObjectId | string;
  consignmentId: Types.ObjectId | string;
  travellerId: Types.ObjectId | string;
  requestedBy: Types.ObjectId | string; // could be sender or traveller
  status:
    | "pending"
    | "accepted_pending_payment"
    | "accepted"
    | "rejected"
    | "expired";
  senderPayAmount: number;
  travellerEarning: number;
}

export interface CarryRequestNotificationPayload {
  consignmentId: Types.ObjectId | string;
  carryRequestId: Types.ObjectId | string;
  senderId: Types.ObjectId | string;
  travellerId: Types.ObjectId | string;
  status: "pending" | "accepted" | "rejected";
  consignmentDescription?: string;
  message: string;
  senderPayAmount: number;
  travellerEarning: number;
  createdAt: string | Date;
}

export interface PaymentPayload {
  paymentId: Types.ObjectId | string;
  consignmentId: Types.ObjectId | string;
  travelId: Types.ObjectId | string;
  amount: number;
  payerId: Types.ObjectId | string;
  status: "pending" | "completed" | "failed";
}

export interface PaymentRequestPayload {
  consignmentId: Types.ObjectId | string;
  carryRequestId: Types.ObjectId | string;
  travelId: Types.ObjectId | string;
  travellerId: Types.ObjectId | string;
  amount: number;
}

export interface TravelConsignmentStatusPayload {
  travelConsignmentId: Types.ObjectId | string;
  consignmentId: Types.ObjectId | string;
  travelId: Types.ObjectId | string;
  status: "to_handover" | "in_transit" | "delivered";
  pickupTime?: string;
  deliveryTime?: string;
  travellerEarning?: number;
  senderToPay?: number;
  message: string;
}

export interface NotificationPayload {
  userId: Types.ObjectId | string;
  title: string;
  message: string;
  relatedConsignmentId?: Types.ObjectId | string;
  requestId?: Types.ObjectId | string;
  relatedTravelId?: Types.ObjectId | string;
  isRead?: boolean;
}
