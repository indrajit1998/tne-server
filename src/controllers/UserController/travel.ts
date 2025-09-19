import type { Response } from "express";
import { TravelModel } from "../../models/travel.model";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import { Address } from "../../models/address.model";
import mongoose from "mongoose";
import { getDistance } from "../../services/maps.service";
import { formatDuration } from "../../lib/utils";

export const createTravel = async (req: AuthRequest, res: Response) => {
  try {
    const travelerId = req.user;
    const {
      fromAddressId,
      toAddressId,
      expectedStartDate,
      expectedEndDate,
      vehicleType,
      vehicleNumber,
      durationOfStay,
      modeOfTravel,
    } = req.body;

    // Validate ObjectIds first
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
      landmark: fromAddressObj.landMark,
      flatNo: fromAddressObj.flatNo,
    };

    const toAddress = {
      street: toAddressObj.street,
      city: toAddressObj.city,
      postalCode: toAddressObj.postalCode,
      country: toAddressObj.country,
      state: toAddressObj.state,
      landmark: toAddressObj.landMark,
      flatNo: toAddressObj.flatNo,
    };

    const distance = await getDistance(fromAddressObj.city, toAddressObj.city);
    const durationOfTravel = formatDuration(expectedStartDate, expectedEndDate);
    const travel = await TravelModel.create({
      travelerId,
      fromAddress,
      toAddress,
      fromCoordinates: fromAddressObj.location,
      toCoordinates: toAddressObj.location,
      expectedStartDate,
      expectedEndDate,
      distance: distance ? distance.distance : "N/A",
      vehicleType,
      vehicleNumber,
      durationOfStay,
      durationOfTravel,
      status: "upcoming",
      modeOfTravel, // ✅ now included
    });

    res.status(201).json({ message: "Travel created successfully", travel });
  } catch (error: any) {
    console.error("Error creating travel:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getTravels = async (req: AuthRequest, res: Response) => {
  try {
    const travelerId = req.user;
    const travels = await TravelModel.find({ travelerId: travelerId }).sort({
      createdAt: -1,
    });
    if (!travels || travels.length === 0) {
      return res.status(404).json({ message: "No travels found" });
    }
    return res
      .status(200)
      .json({ message: "Travels fetched successfully", travels });
  } catch (error) {
    console.error("Error fetching travels:", error);
    res
      .status(500)
      .json({ message: "Internal server error while fetching travels" });
  }
};

export const locateTravel = async (req: AuthRequest, res: Response) => {
  try {
    const { fromstate, tostate } = req.body;
    const currentUserId = req.user;
    const travels = await TravelModel.find({
      "fromAddress.state": fromstate,
      "toAddress.state": tostate,
      status: "upcoming",
      travelerId:currentUserId,
    });
    if (!travels || travels.length === 0) {
      return res.status(404).json({ message: "No travels found", travels: [] });
    }
    return res
      .status(200)
      .json({ message: "Travels fetched successfully", travels });
  } catch (error) {
    console.error("Error locating travel:", error);
    res
      .status(500)
      .json({ message: "Internal server error while locating travel" });
  }
};

export const locateTravelbyid = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const travel = await TravelModel.findById(id);
    if (!travel) {
      return res.status(404).json({ message: "No travel found" });
    }
    return res
      .status(200)
      .json({ message: "Travel fetched successfully", travel });
  } catch (error) {
    console.error("Error fetching travel by ID:", error);
    res
      .status(500)
      .json({ message: "Internal server error while fetching travel by ID" });
  }
};
