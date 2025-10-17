import { getIO } from ".";
import type {
  CarryRequestNotificationPayload,
  CarryRequestPayload,
  PaymentPayload,
  PaymentRequestPayload,
  TravelConsignmentStatusPayload,
} from "./payload";
import type { ServerToClientEvents } from "./types";

const emitToUser = async <E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0]
) => {
  const io = getIO();
  const room = `user:${userId}`;
  io.to(room).emit(event, payload);
};

// Event helpers

// 1. Traveller requests to carry a consignment (sent to consignment owner)
export const emitCarryRequestSent = async (
  consignmentOwnerId: string,
  payload: CarryRequestNotificationPayload
) => {
  await emitToUser(consignmentOwnerId, "carry:request:sent", payload);
};

// 2.Consignment owner accepts traveller's request (sent to traveller)
export const emitCarryRequestAccepted = async (
  travellerId: string,
  payload: CarryRequestPayload
) => {
  await emitToUser(travellerId, "carry:request:accepted", payload);
};

// 3. Consignment owner rejects traveller's request (sent to traveller)
export const emitCarryRequestRejected = async (
  travellerId: string,
  payload: CarryRequestPayload
) => {
  await emitToUser(travellerId, "carry:request:rejected", payload);
};

// 4. Payment successful from consignment owner to traveller (sent to traveller)
export const emitPaymentSuccess = async (
  travellerId: string,
  payload: PaymentPayload
) => {
  await emitToUser(travellerId, "carry:payment:success", payload);
};

// Payment failed (optional, sent to sender)
export const emitPaymentFailed = async (
  senderId: string,
  payload: PaymentPayload
) => {
  await emitToUser(senderId, "carry:payment:failed", payload);
};

// 5. Traveller collected consignment (OTP validated) (sent to consignment owner)
export const emitConsignmentCollected = async (
  consignmentOwnerId: string,
  payload: TravelConsignmentStatusPayload
) => {
  await emitToUser(consignmentOwnerId, "consignment:collected", payload);
};

// 6. Traveller delivered consignment at destination (sent to consignment owner)
export const emitConsignmentDelivered = async (
  consignmentOwnerId: string,
  payload: TravelConsignmentStatusPayload
) => {
  await emitToUser(consignmentOwnerId, "consignment:delivered", payload);
};

// 7 Notify sender to initiate payment (Pay Now)
export const emitPaymentRequest = async (
  senderId: string,
  payload: PaymentRequestPayload
) => {
  await emitToUser(senderId, "carry:payment:pending", payload);
};
