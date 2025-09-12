import type { Request, Response } from "express";

import { Types } from "mongoose";
import ConsignmentModel from "../../models/consignment.model";

export const createConsignment = async (req: Request, res: Response) => {
  try {
    const {
      senderId,
      fromAddress,
      toAddress,
      fromCoordinates,
      toCoordinates,
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
      status,
    } = req.body;
  
    if (!senderId || !fromAddress || !toAddress) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const consignment = new ConsignmentModel({
      senderId: new Types.ObjectId(senderId),
      fromAddress,
      toAddress,
      fromCoordinates,
      toCoordinates,
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
      status,
    });

    const savedConsignment = await consignment.save();

    return res.status(201).json({
      message: "Consignment created successfully",
      consignment: savedConsignment,
    });
  } catch (error: any) {
    console.error("❌ Error creating consignment:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


