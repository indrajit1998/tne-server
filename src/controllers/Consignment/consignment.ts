import type { Request, Response } from "express";

import { Types } from "mongoose";
import ConsignmentModel from "../../models/consignment.model";
import type { AuthRequest } from "../../middlewares/authMiddleware";

import mongoose from "mongoose";
import { Address } from "../../models/address.model";
import logger from "../../lib/logger";
import { getDistance } from "../../services/maps.service";

export const createConsignment = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user;
    const {
      fromAddressId,
      toAddressId,
      weight,
      weightUnit,
      dimensions,
      sendingDate,
      receiverName,
      receiverPhone,
      category,
      subCategory,
      description,
      handleWithCare,
      images,
    } = req.body;

    if (!senderId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }
    if (!fromAddressId || !toAddressId) {
      return res
        .status(400)
        .json({ message: "Both fromAddressId and toAddressId are required" });
    }
    if (
      !mongoose.Types.ObjectId.isValid(fromAddressId) ||
      !mongoose.Types.ObjectId.isValid(toAddressId)
    ) {
      return res.status(400).json({ message: "Invalid address format" });
    }

    const fromAddressObj = await Address.findById(fromAddressId);
    const toAddressObj = await Address.findById(toAddressId);

    if (!fromAddressObj || !toAddressObj) {
      return res.status(400).json({ message: "Invalid address IDs" });
    }

    const fromAddress = {
      street: fromAddressObj.street,
      city: fromAddressObj.city,
      postalCode: fromAddressObj.postalCode,
      country: fromAddressObj.country,
      state: fromAddressObj.state,
      flatNo: fromAddressObj.flatNo,
      landmark: fromAddressObj.landMark,
    };

    const toAddress = {
      street: toAddressObj.street,
      city: toAddressObj.city,
      postalCode: toAddressObj.postalCode,
      country: toAddressObj.country,
      state: toAddressObj.state,
      flatNo: toAddressObj.flatNo,
      landmark: toAddressObj.landMark,
    };
    const distance = await getDistance(fromAddressObj.city, toAddressObj.city);
    logger.info(`Calculated distance: ${distance} km`);
    logger.info(`Distance between addresses: ${distance} km`);
    const consignment = await ConsignmentModel.create({
      senderId: senderId,
      fromAddress,
      toAddress,
      fromCoordinates: fromAddressObj.location,
      toCoordinates: toAddressObj.location,
      weight,
      distance: distance?.distance || "N/A",
      weightUnit,
      dimensions,
      sendingDate,
      receiverName,
      receiverPhone,
      category,
      subCategory,
      description,
      handleWithCare,
      images,
      status: "published",
    });

    return res
      .status(201)
      .json({ message: "Consignment created successfully", consignment });
  } catch (error: any) {
    console.error("❌ Error creating consignment:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getConsignments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }
    const consignments = await ConsignmentModel.find({ senderId: userId }).sort(
      { createdAt: -1 }
    );
    return res
      .status(200)
      .json({ message: "Consignments retrieved successfully", consignments });
  } catch (error) {
    console.error("❌ Error fetching consignments:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const locateConsignment = async (req: AuthRequest, res: Response) => {
  try {
    const { fromstate, tostate } = req.body;
    const currentUserId = req.user;
    logger.info("Locating consignments from" + fromstate + "to" + tostate);
    const consignments = await ConsignmentModel.find({
      "fromAddress.state": fromstate,
      "toAddress.state": tostate,
      senderId: { $ne: currentUserId },
    });

    if (!consignments || consignments.length === 0) {
      return res
        .status(404)
        .json({ message: "No consignments found", consignments: [] });
    }
    return res
      .status(200)
      .json({ message: "Consignments fetched successfully", consignments });
  } catch (error) {
    console.error("❌ Error locating consignments:", error);
    return res
      .status(500)
      .json({ message: "Internal server error while locating consignments" });
  }
};

export const locateConsignmentById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const consignmentId = req.params.id;
    if (!consignmentId) {
      return res.status(400).json({ message: "Consignment ID is required" });
    }
    if (!Types.ObjectId.isValid(consignmentId)) {
      return res.status(400).json({ message: "Invalid consignment ID format" });
    }
    const consignment = await ConsignmentModel.findById(consignmentId);
    if (!consignment) {
      return res.status(404).json({ message: "No consignment found" });
    }
    return res
      .status(200)
      .json({ message: "Consignment fetched successfully", consignment });
  } catch (error) {
    console.error("❌ Error fetching consignment by ID:", error);
    return res.status(500).json({
      message: "Internal server error while fetching consignment by ID",
    });
  }
};
