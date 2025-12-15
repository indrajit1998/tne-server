import type {
  CarryRequestNotificationPayload,
  CarryRequestPayload,
  LocationEmitPayload,
  LocationJoinPayload,
  LocationUpdatePayload,
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

  // 🆕 ADD THESE NEW LOCATION EVENTS
  "location:update": (data: LocationUpdatePayload) => void;
  "connection:ack": (data: { message: string; userId: string }) => void;
  "pong:server": (data: { time: string }) => void;
}

export interface ClientToServerEvents {
  "user:join": (userId: string) => void;
  "user:disconnect": (userId: string) => void;
  "ping:client": () => void;

  // 🆕 ADD THESE NEW LOCATION EVENTS
  "location:join": (data: LocationJoinPayload) => void;
  "location:leave": (travelConsignmentId: string) => void;
  "location:emit": (data: LocationEmitPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}
