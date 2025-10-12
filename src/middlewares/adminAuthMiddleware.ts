// import type { Request, Response, NextFunction } from "express";
// import jwt from "jsonwebtoken";
// import type { JwtPayload } from "jsonwebtoken";
// import env from "../lib/env.js";
// import { AdminModel } from "../models/admin.model.js";
// import { th } from "zod/locales";

// export interface AdminAuthRequest extends Request {
//   admin?: string | (JwtPayload & { _id: string });
// }

// export const isAdminAuthMiddleware = async(req: AdminAuthRequest, res: Response, next: NextFunction) => {
//     try {
//         const token = req.cookies.token;
//         if (!token) {
//             return res.status(401).json({ message: "No token provided" });
//         }
//         const decoded = jwt.verify(token, env.JWT_SECRET)  as JwtPayload & { _id: string };
//         if (!decoded) {
//             return res.status(403).json({ message: "Forbidden" });
//         }
//         req.admin = decoded._id;
//         const isAdmin = await AdminModel.findById(req.admin);
//         if (!isAdmin) {
//             throw new Error("Admin not found");
//         }

//         next();
//     } catch (error) {
//         console.error("Error during admin authentication:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// }

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import env from "../lib/env.js";
import { AdminModel } from "../models/admin.model.js";

export interface AdminAuthRequest extends Request {
  admin?: string | JwtPayload; 
}

export const isAdminAuthMiddleware = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; 
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded !== 'object' || !decoded._id) {
        return res.status(401).json({ message: "Invalid token payload" });
    }

    const admin = await AdminModel.findById(decoded._id);
    if (!admin) {
      return res.status(401).json({ message: "Admin not found with this token" });
    }
    req.admin = decoded; 
    next();

  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};