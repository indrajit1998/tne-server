import type { Response } from "express";
import { CODES } from "../constants/statusCodes";
import sendResponse from "../lib/ApiResponse";
import logger from "../lib/logger";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { Address } from "../models/address.model";
import { addressSchema } from "../validations/zod";

export const addAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    console.log("Request Body:", req.body); // Debugging line

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

export const getAddresses = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const addresses = await Address.find({ userId: userId }).lean();
    return res
      .status(CODES.OK)
      .json(
        sendResponse(CODES.OK, addresses, "Addresses retrieved successfully")
      );
  } catch (error) {
    logger.error("Error retrieving addresses: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Failed to retrieve addresses"
        )
      );
  }
};

export const updateAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const { id } = req.params;
    if (!id) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Address ID is required"));
    }

    const validatedData = addressSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(CODES.BAD_REQUEST).json({
        message: "Invalid address data",
        errors: validatedData.error.issues,
      });
    }

    const addressData = validatedData.data;

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: id, userId },
      {
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
          coordinates: [
            addressData.coordinates.lng,
            addressData.coordinates.lat,
          ],
        },
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "Address not found"));
    }

    return res
      .status(CODES.OK)
      .json(
        sendResponse(CODES.OK, updatedAddress, "Address updated successfully")
      );
  } catch (error) {
    logger.error("Error updating address: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Failed to update address"
        )
      );
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const { id } = req.params;
    if (!id) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Address ID is required"));
    }

    const deletedAddress = await Address.findOneAndDelete({ _id: id, userId });

    if (!deletedAddress) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "Address not found"));
    }

    return res
      .status(CODES.OK)
      .json(
        sendResponse(CODES.OK, deletedAddress, "Address deleted successfully")
      );
  } catch (error) {
    logger.error("Error deleting address: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Failed to delete address"
        )
      );
  }
};
