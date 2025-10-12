export interface ServerToClientEvents {
  "carry:request:sent": (data: any) => void;
  "carry:request:accepted": (data: any) => void;
  "carry:request:rejected": (data: any) => void;
  "carry:payment:success": (data: any) => void;
  "consignment:collected": (data: any) => void;
  "consignment:delivered": (data: any) => void;
}

export interface ClientToServerEvents {
  "user:join": (userId: string) => void;
  "user:disconnect": (userId: string) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}
