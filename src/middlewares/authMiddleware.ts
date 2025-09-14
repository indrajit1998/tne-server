import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import env from "../lib/env.js";

export interface AuthRequest extends Request {
  user?: string | (JwtPayload & { _id: string });
}

const isAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    if (!env.JWT_SECRET) {
      throw new Error("JWT_SECRET not defined in env");
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { _id: string };
    req.user = decoded._id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default isAuthMiddleware;
