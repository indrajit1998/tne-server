import type { Request } from "express";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { AdminModel } from "../../models/admin.model";
import env from "../../lib/env";
import { cookiesOption } from "../../constants/constant";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";

export const adminLogin = async (req:Request, res:Response) => { 
    try {
        const { email, password } = req.body;

        const admin = await AdminModel.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = jwt.sign(
            { _id: admin._id, email: admin.email },
            env.JWT_SECRET,
            { expiresIn: "7d" }
          );
          res.cookie("token", token, cookiesOption);
        return res.status(CODES.OK).json(sendResponse(CODES.OK, null, "Login successful"));
    } catch (error) {
        console.error("Error during admin login:", error);
        res.status(500).json({ message: "Internal server error" });
    }

}