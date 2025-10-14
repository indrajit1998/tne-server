import type {
  CarryRequestNotificationPayload,
  CarryRequestPayload,
  PaymentPayload,
  PaymentRequestPayload,
  TravelConsignmentStatusPayload,
} from "./payload";

export interface ServerToClientEvents {
  "carry:request:sent": (data: CarryRequestNotificationPayload) => void;
  "carry:request:accepted": (data: CarryRequestPayload) => void;
  "carry:request:rejected": (data: CarryRequestPayload) => void;
  "carry:request:expired": (data: CarryRequestPayload) => void;
  "carry:payment:success": (data: PaymentPayload) => void;
  "carry:payment:failed": (data: PaymentPayload) => void;
  "consignment:collected": (data: TravelConsignmentStatusPayload) => void;
  "consignment:delivered": (data: TravelConsignmentStatusPayload) => void;
  "consignment:handover:failed": (data: TravelConsignmentStatusPayload) => void;
  "carry:payment:pending": (data: PaymentRequestPayload) => void;
}

export interface ClientToServerEvents {
  "user:join": (userId: string) => void;
  "user:disconnect": (userId: string) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}
