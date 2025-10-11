import type { Response } from "express";
import mongoose from "mongoose";
import logger from "../../lib/logger";
import { formatDuration } from "../../lib/utils";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import { Address } from "../../models/address.model";
import { TravelModel } from "../../models/travel.model";
import { getDistance } from "../../services/maps.service";

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
    const { fromstate, tostate, date, modeOfTravel } = req.query as {
      fromstate: string;
      tostate: string;
      date: string;
      modeOfTravel?: "air" | "roadways" | "train";
    };
    const currentUserId = req.user;

    if (!fromstate || !tostate || !date) {
      return res.status(400).json({
        message: "Missing required query parameters: fromstate, tostate, date",
      });
    }

    // Normalize and tokenize for flexible partial matching
    const tokenize = (str: string) =>
      str
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);

    const fromTokens = tokenize(fromstate);
    const toTokens = tokenize(tostate);

    const fromRegexes = fromTokens.map((t) => new RegExp(t, "i"));
    const toRegexes = toTokens.map((t) => new RegExp(t, "i"));

    // Date range (whole day)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    // Default travel mode (optional param)
    const travelMode = modeOfTravel || undefined;

    logger.info(
      `🔍 Locating travels from "${fromstate}" → "${tostate}" on ${startOfDay.toISOString()} ${
        travelMode ? `(mode: ${travelMode})` : ""
      }`
    );

    const query: any = {
      $and: [
        {
          $or: [
            { "fromAddress.state": { $in: fromRegexes } },
            { "fromAddress.city": { $in: fromRegexes } },
            { "fromAddress.street": { $in: fromRegexes } },
          ],
        },
        {
          $or: [
            { "toAddress.state": { $in: toRegexes } },
            { "toAddress.city": { $in: toRegexes } },
            { "toAddress.street": { $in: toRegexes } },
          ],
        },
        {
          expectedStartDate: { $gte: startOfDay, $lt: endOfDay },
          status: "upcoming",
          travelerId: { $ne: currentUserId },
        },
      ],
    };

    if (travelMode) query.$and.push({ modeOfTravel: travelMode });

    const travels = await TravelModel.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (!travels.length) {
      logger.info(
        `❌ No travels found for ${fromstate} → ${tostate} on ${date} ${
          travelMode ? `(${travelMode})` : ""
        }`
      );
      return res.status(404).json({ message: "No travels found", travels: [] });
    }

    return res
      .status(200)
      .json({ message: "Travels fetched successfully", travels });
  } catch (error: any) {
    logger.error("❌ Error locating travel:", error);
    return res.status(500).json({
      message: "Internal server error while locating travel",
      error: error instanceof Error ? error.message : error,
    });
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
