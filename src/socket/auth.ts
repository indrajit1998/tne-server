import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Socket } from "socket.io";
import env from "../lib/env";
import type { SocketData } from "./types";

interface DecodedToken extends JwtPayload {
  _id: string;
}

export const socketAuthMiddleware = async (
  socket: Socket & { data: SocketData },
  next: (err?: Error) => void
) => {
  try {
    let token = socket.handshake.auth?.token;
    if (!token && socket.handshake.headers?.authorization) {
      const parts = socket.handshake.headers.authorization.split(" ");
      if (parts.length === 2) token = parts[1];
    }

    console.log("Incoming socket token:", token);

    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET!) as DecodedToken;

    if (!decoded?._id) {
      return next(new Error("Invalid or missing user ID in token"));
    }

    socket.data.userId = decoded._id;
    next();
  } catch (error) {
    next(new Error("Socket authentication failed"));
  }
};
