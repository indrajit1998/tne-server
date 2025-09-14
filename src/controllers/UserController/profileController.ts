import type { Response } from "express";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";
import { User } from "../../models/user.model";
import type { AuthRequest } from "../../middlewares/authMiddleware.js";
import { TravelModel } from "../../models/travel.model.js";
import ConsignmentModel from "../../models/consignment.model.js";

 
 export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res.status(CODES.UNAUTHORIZED).json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const user = await User.findById(userId).select("-__v -createdAt -updatedAt -_id");
    if (!user) {
      return res.status(CODES.NOT_FOUND).json(sendResponse(CODES.NOT_FOUND, null, "User not found"));
    }
    return res.status(CODES.OK).json(sendResponse(CODES.OK, user, "User profile fetched successfully"));
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong"));
  }
};


export const getTravelAndConsignment = async (req: AuthRequest, res: Response) => {
  try {
    const userId=req.user;
    if (!userId) {
      return res.status(CODES.UNAUTHORIZED).json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }
    const travels=await TravelModel.find({ travelerId: userId }).sort({ createdAt: -1 });
    const consignments = await ConsignmentModel.find({ senderId: userId }).sort({ createdAt: -1 });
    return res.status(CODES.OK).json(sendResponse(CODES.OK, {travels, consignments}, "Travel and Consignment data fetched successfully"));
    
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong while fetching travel and consignment data"));
  }
}