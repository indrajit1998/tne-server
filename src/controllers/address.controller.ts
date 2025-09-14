import type { Request, Response } from "express";
import { addressSchema } from "../validations/zod";
import { Address } from "../models/address.model";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { CODES } from "../constants/statusCodes";
import sendResponse from "../lib/ApiResponse";
import logger from "../lib/logger";
export const addAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }
    const validatedData = addressSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(400).json({
        message: "Invalid address data",
        errors: validatedData.error.issues,
      });
    }
    const addressData = validatedData.data;

    const address = await Address.create({
      userId,
      city: addressData.city,
      country: addressData.country,
      flatNo: addressData.flatNo,
      landMark: addressData.landMark,
      label: addressData.label,
      postalCode: addressData.postalCode,
      state: addressData.state,
      street: addressData.street,
      location: {
        type: "Point",
        coordinates: [addressData.coordinates.lng, addressData.coordinates.lat],
      },
    });

    return res
      .status(CODES.CREATED)
      .json(sendResponse(CODES.CREATED, address, "Address added successfully"));
  } catch (error) {
    logger.error("Error adding address: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Failed to add address")
      );
  }
};
