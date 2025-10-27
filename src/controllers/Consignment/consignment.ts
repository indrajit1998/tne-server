import type { Response } from "express";

import { Types } from "mongoose";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import ConsignmentModel from "../../models/consignment.model";

import mongoose from "mongoose";

import { getDateRange } from "../../lib/dateUtils";
import logger from "../../lib/logger";
import {
  calculateFlightFare,
  calculateTrainFare,
} from "../../lib/pricingLogic";
import {
  calculateSenderPay,
  calculateTravellerEarning,
  calculateVolumetricWeight,
  formatCoordinates,
} from "../../lib/utils";
import { Address } from "../../models/address.model";
import { CarryRequest } from "../../models/carryRequest.model";
import Earning from "../../models/earning.model";
import Notification from "../../models/notification.model";
import { TravelModel } from "../../models/travel.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { User } from "../../models/user.model";
import { getDistance } from "../../services/maps.service";
import {
  emitCarryRequestAccepted,
  emitCarryRequestRejected,
  emitCarryRequestSent,
  emitConsignmentCollected,
  emitConsignmentDelivered,
  emitPaymentRequest,
} from "../../socket/events";
import { notificationHelper } from "../Notifications/notification";

// helper type for GeoJSON coords
interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

// helper for populated consignment
interface PopulatedConsignment {
  _id: string;
  fromAddress: Record<string, any>;
  toAddress: Record<string, any>;
  fromCoordinates?: GeoPoint;
  toCoordinates?: GeoPoint;
  distance?: string;
  weight?: number;
  weightUnit?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  images?: string[];
  senderId?: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    email?: string;
    phoneNumber?: string;
  };
}

// helper for populated travel
interface PopulatedTravel {
  _id: string;
  fromAddress: Record<string, any>;
  toAddress: Record<string, any>;
  fromCoordinates?: GeoPoint;
  toCoordinates?: GeoPoint;
  modeOfTravel?: string;
  travelDate?: Date;
  availableWeight?: number;
  description?: string;
}

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

    console.log("REQ BODY OF CREATE CONSIGNMENT => ", {
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
    });

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

    const volumetricWeight = calculateVolumetricWeight(
      dimensions.length,
      dimensions.width,
      dimensions.height,
      dimensions.unit || "cm"
    );

    console.log("volumetricWeight:", volumetricWeight);
    console.log("dimensions:", dimensions);

    const weightInKg = Math.max(weight, volumetricWeight);

    console.log("Weight in Kg:", weightInKg);

    if (weightInKg <= 0) {
      return res.status(400).json({ message: "Invalid weight" });
    }

    console.log("Calculating distance between cities");
    console.log("From City:", fromAddressObj.city);
    console.log("To City:", toAddressObj.city);

    const distance = await getDistance(fromAddressObj.city, toAddressObj.city);
    console.log("Distance:", distance?.distance ? distance.distance : 0);

    const trainPricing = await calculateTrainFare(
      weightInKg,
      distance?.distanceValue || 0
    );

    const flightPricing = await calculateFlightFare(
      weightInKg,
      distance?.distanceValue || 0
    );
    console.log("Flight Pricing:", flightPricing);

    const consignment = await ConsignmentModel.create({
      senderId: senderId,
      fromAddress,
      toAddress,
      fromCoordinates: fromAddressObj.location,
      toCoordinates: toAddressObj.location,
      weight: weightInKg,
      distance: distance?.distance || "N/A",
      weightUnit,
      dimensions,
      sendingDate,
      receiverName,
      flightPrice: flightPricing,
      trainPrice: trainPricing,
      roadWaysPrice: trainPricing,
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
    const currentUserId = req.user;
    const { fromstate, tostate, date } = req.query as {
      fromstate: string;
      tostate: string;
      date: string;
    };

    if (!fromstate || !tostate || !date) {
      return res
        .status(400)
        .json({ message: "fromstate, tostate and date are required" });
    }

    logger.info(
      "Inside locateConsignment: = >" +
        {
          fromstate,
          tostate,
          date,
        }
    );

    // Normalize and tokenize
    const tokenize = (str: string) =>
      str
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);

    const fromTokens = tokenize(fromstate);
    const toTokens = tokenize(tostate);

    const fromRegexes = fromTokens.map((token) => new RegExp(token, "i"));
    const toRegexes = toTokens.map((token) => new RegExp(token, "i"));

    // Parse date using utility
    let startOfDay: Date, endOfDay: Date;
    try {
      ({ startOfDay, endOfDay } = getDateRange(date));

      logger.info(
        {
          originalDate: date,
          startOfDay: startOfDay.toISOString(),
          endOfDay: endOfDay.toISOString(),
        },
        "Parsed date range"
      );
    } catch (error) {
      logger.error(`Date parsing error: ${error}`);
      return res.status(400).json({
        message: `Invalid date format: ${date}. Expected DD/MM/YYYY (e.g., 25/11/2025)`,
        error: error instanceof Error ? error.message : "Date parsing failed",
      });
    }

    logger.info(
      `🔍 Locating consignments from "${fromstate}" → "${tostate}" on ${startOfDay.toISOString()}`
    );

    const consignments = await ConsignmentModel.find({
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
          sendingDate: { $gte: startOfDay, $lt: endOfDay },
          status: "published",
          senderId: { $ne: currentUserId },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (!consignments || consignments.length === 0) {
      logger.info(
        `❌ No consignments found for ${fromstate} → ${tostate} on ${date}`
      );
      return res.status(404).json({
        message: "No consignments found for the given route and date",
        consignments: [],
      });
    }

    return res.status(200).json({
      message: "Consignments fetched successfully",
      consignments,
    });
  } catch (error: any) {
    logger.error("❌ Error locating consignments:", error);
    return res.status(500).json({
      message: "Internal server error while locating consignments",
      error: error instanceof Error ? error.message : error,
    });
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

export const getCarryRequestById = async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: Missing user" });
    }

    if (!requestId) {
      return res.status(400).json({ message: "Missing requestId" });
    }

    const carryRequest = await CarryRequest.findById(requestId)
      .populate({
        path: "travellerId",
        model: User,
        select: "firstName lastName profilePicture rating reviewCount email",
      })
      .populate({
        path: "requestedBy",
        model: User,
        select: "firstName lastName profilePicture email",
      })
      .populate({
        path: "consignmentId",
        model: ConsignmentModel,
        select:
          "fromAddress toAddress fromCoordinates toCoordinates distance weight weightUnit description category subCategory images senderId",
        populate: {
          path: "senderId",
          model: User,
          select: "firstName lastName profilePicture email phoneNumber",
        },
      })
      .lean();

    if (!carryRequest) {
      return res.status(404).json({ message: "Carry request not found" });
    }

    // const formatCoordinates = (coords?: GeoPoint) => {
    //   if (!coords || !Array.isArray(coords.coordinates)) return null;
    //   return {
    //     latitude: coords.coordinates[1],
    //     longitude: coords.coordinates[0],
    //   };
    // };

    function isPopulatedConsignment(obj: unknown): obj is PopulatedConsignment {
      return !!obj && typeof obj === "object" && "fromAddress" in obj;
    }

    const consignment = isPopulatedConsignment(carryRequest.consignmentId)
      ? {
          ...carryRequest.consignmentId,
          fromCoordinates: formatCoordinates(
            carryRequest.consignmentId.fromCoordinates
          ),
          toCoordinates: formatCoordinates(
            carryRequest.consignmentId.toCoordinates
          ),
        }
      : null;

    // related travel fetch + format
    const relatedTravelDoc = carryRequest.travelId
      ? await TravelModel.findById(carryRequest.travelId)
          .select(
            "fromAddress toAddress fromCoordinates toCoordinates expectedStartDate expectedEndDate vehicleNumber durationOfStay durationOfTravel status modeOfTravel vehicleType travelDate availableWeight description"
          )
          .lean()
      : null;

    const relatedTravel = relatedTravelDoc
      ? {
          ...relatedTravelDoc,
          fromCoordinates: formatCoordinates(relatedTravelDoc.fromCoordinates),
          toCoordinates: formatCoordinates(relatedTravelDoc.toCoordinates),
        }
      : null;

    const formattedCarryRequest = {
      _id: carryRequest._id,
      consignment,
      traveller: carryRequest.travellerId || null,
      requestedByUser: carryRequest.requestedBy || null,
      status: carryRequest.status,
      senderPayAmount: carryRequest.senderPayAmount,
      travellerEarning: carryRequest.travellerEarning,
      createdAt: carryRequest.createdAt,
      updatedAt: carryRequest.updatedAt,
      relatedTravel,
    };

    logger.info(
      `📦 Carry request fetched by ID ${requestId} for user ${userId}`
    );

    return res.status(200).json({
      message: "Carry request fetched successfully",
      carryRequest: formattedCarryRequest,
    });
  } catch (error: any) {
    logger.error("❌ Error fetching carry request by ID:", error);
    return res.status(500).json({
      message: "Internal server error while fetching carry request",
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const carryRequestBySender = async (req: AuthRequest, res: Response) => {
  try {
    const { consignmentId, travelId } = req.body;

    if (!consignmentId || !travelId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const consignment = await ConsignmentModel.findById(consignmentId);

    if (!consignment) {
      return res.status(404).json({ message: "No consignment found" });
    }
    console.log("Consignment:", consignment);

    const consignmentSender = consignment?.senderId;

    const travel = await TravelModel.findById(travelId);

    if (!travel) {
      return res.status(404).json({ message: "No travel found" });
    }

    if (
      travel.fromAddress.state !== consignment.fromAddress.state ||
      travel.toAddress.state !== consignment.toAddress.state
    ) {
      return res
        .status(400)
        .json({ message: "Travel route does not match consignment route" });
    }

    const modelOfTravel = travel.modeOfTravel;
    console.log("Model of Travel:", modelOfTravel);

    const travellerEarning = calculateTravellerEarning(
      modelOfTravel,
      consignment
    );

    const senderPay = calculateSenderPay(modelOfTravel, consignment);

    const existingRequest = await CarryRequest.findOne({
      consignmentId: consignmentId,
      travellerId: travel.travelerId,
      requestedBy: consignmentSender,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        message:
          "You have already sent a carry request for this consignment and travel",
      });
    }

    const carryRequestBySender = await CarryRequest.create({
      consignmentId: consignmentId,
      travellerId: travel.travelerId,
      requestedBy: consignmentSender,
      status: "pending",
      travelId: travelId,
      senderPayAmount: senderPay,
      travellerEarning: travellerEarning,
    });

    if (!carryRequestBySender) {
      return res
        .status(500)
        .json({ message: "Error in creating carry request" });
    }

    // SOCKET EMIT: notify consignment owner
    await emitCarryRequestSent(consignmentSender.toString(), {
      carryRequestId: carryRequestBySender._id.toString(),
      consignmentId: consignmentId,
      senderId: consignmentSender.toString(), // must add this
      travellerId: travel.travelerId.toString(),
      senderPayAmount: senderPay,
      travellerEarning: travellerEarning,
      status: "pending",
      consignmentDescription: consignment.description, // optional
      message: `Carry request sent for consignment: ${consignment.description}`, // must add
      createdAt: carryRequestBySender.createdAt,
    });

    const notificationData = await notificationHelper(
      "bySender",
      consignment,
      "travel",
      consignmentSender
    );

    if (!notificationData) {
      return res
        .status(500)
        .json({ message: "Failed to generate notification data" });
    }
    const { title, message } = notificationData;
    const notification = await Notification.create({
      userId: travel.travelerId,
      title,
      message,
      isRead: false,
      relatedConsignmentId: consignment._id,
      requestId: carryRequestBySender._id,
      relatedTravelId: travelId,
    });
    if (!notification) {
      return res
        .status(500)
        .json({ message: "Error in creating notification" });
    }
    return res.status(201).json({
      message: "Carry request sent successfully",
      carryRequestBySender,
    });
  } catch (error) {
    console.error("❌ Error in carry request by sender:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const carryRequestByTraveller = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { consignmentId, travelId } = req.body;
    const travellerId = req.user;

    if (!travellerId || !consignmentId || !travelId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const travel = await TravelModel.findById(travelId);
    if (!travel) {
      return res.status(404).json({ message: "No travel found" });
    }

    if (travel.travelerId.toString() !== travellerId) {
      return res.status(403).json({
        message: "You are not authorized to send carry request for this travel",
      });
    }

    const consignment = await ConsignmentModel.findById(consignmentId);
    if (!consignment) {
      return res.status(404).json({ message: "No consignment found" });
    }

    const consignmentSenderId = consignment?.senderId;

    const travellerEarning = calculateTravellerEarning(
      travel.modeOfTravel,
      consignment
    );

    const senderPay = calculateSenderPay(travel.modeOfTravel, consignment);

    const existingRequest = await CarryRequest.findOne({
      consignmentId: consignmentId,
      travellerId: travellerId,
      requestedBy: travellerId,
      status: "pending",
    });
    if (existingRequest) {
      return res.status(400).json({
        message:
          "You have already sent a carry request for this consignment and travel",
      });
    }

    const carryRequestByTraveller = await CarryRequest.create({
      consignmentId: consignmentId,
      travellerId: travellerId,
      requestedBy: travellerId,
      travelId: travelId,
      status: "pending",
      senderPayAmount: senderPay,
      travellerEarning: travellerEarning,
    });

    if (!carryRequestByTraveller) {
      return res
        .status(500)
        .json({ message: "Error in creating carry request" });
    }

    // EMIT socket event
    await emitCarryRequestSent(consignmentSenderId.toString(), {
      carryRequestId: carryRequestByTraveller._id.toString(),
      consignmentId,
      senderId: travellerId, // traveller is the sender here
      travellerId,
      senderPayAmount: senderPay,
      travellerEarning,
      status: "pending",
      consignmentDescription: consignment.description,
      message: `Carry request sent for consignment: ${consignment.description}`,
      createdAt: carryRequestByTraveller.createdAt,
    });

    const notificationData = await notificationHelper(
      "byTraveller",
      consignment,
      "consignment",
      travellerId
    );

    if (!notificationData) {
      return res
        .status(500)
        .json({ message: "Failed to generate notification data" });
    }

    const { title, message } = notificationData;

    const notification = await Notification.create({
      userId: consignmentSenderId,
      title,
      message,
      isRead: false,
      relatedConsignmentId: consignment._id,
      requestId: carryRequestByTraveller._id,
      relatedTravelId: travelId,
    });
    console.log(notification);

    if (!notification) {
      return res
        .status(500)
        .json({ message: "Error in creating notification" });
    }

    console.log("CarryRequestByTraveller: ", carryRequestByTraveller);

    return res.status(201).json({
      message: "Carry request sent successfully",
      carryRequestByTraveller,
    });
  } catch (error) {
    console.error("❌ Error in carry request by traveller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptCarryRequest = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const { carryRequestId, travelId } = req.body;
    if (!carryRequestId) {
      return res.status(400).json({ message: "carryRequestId is required" });
    }

    const carryRequest = await CarryRequest.findOneAndUpdate(
      { _id: carryRequestId, status: "pending" },
      { status: "accepted_pending_payment" },
      { new: true, session }
    );
    if (!carryRequest) {
      throw new Error("Carry request already accepted or invalid");
    }

    const consignment = await ConsignmentModel.findById(
      carryRequest.consignmentId
    ).session(session);
    if (!consignment) {
      return res.status(404).json({ message: "No consignment found" });
    }

    const isTravellerInitiated =
      carryRequest.requestedBy.toString() ===
      carryRequest.travellerId.toString();

    if (
      isTravellerInitiated &&
      userId.toString() !== consignment.senderId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Only sender can accept this request" });
    }
    if (
      !isTravellerInitiated &&
      userId.toString() !== carryRequest.travellerId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Only traveller can accept this request" });
    }

    // Update carryRequest status in DB
    carryRequest.status = "accepted_pending_payment";
    await carryRequest.save({ session });

    // Notify traveller
    await emitCarryRequestAccepted(carryRequest.travellerId.toString(), {
      requestId: carryRequest._id.toString(),
      consignmentId: carryRequest.consignmentId.toString(),
      travellerId: carryRequest.travellerId.toString(),
      requestedBy: carryRequest.requestedBy.toString(),
      status: "accepted_pending_payment",
      senderPayAmount: carryRequest.senderPayAmount,
      travellerEarning: carryRequest.travellerEarning,
    });

    // Update status to accepted_pending_payment
    carryRequest.status = "accepted_pending_payment";
    await carryRequest.save({ session });

    // Notify sender to initiate payment
    const sender = await User.findById(consignment.senderId).session(session);
    if (!sender) return res.status(404).json({ message: "Sender not found" });

    // Create notification for sender to initiate payment
    const notificationData = await Notification.create(
      [
        {
          userId: sender._id,
          title: "Carry Request Accepted",
          message: `Your carry request for consignment "${consignment.description}" has been accepted. Please proceed to payment.`,
          isRead: false,
          relatedConsignmentId: consignment._id,
          requestId: carryRequest._id,
          relatedTravelId: travelId,
        },
      ],
      { session }
    );

    if (!notificationData) {
      return res
        .status(500)
        .json({ message: "Error in creating notification" });
    }
    console.log(notificationData);

    await emitPaymentRequest(sender._id.toString(), {
      consignmentId: consignment._id.toString(),
      carryRequestId: carryRequest._id.toString(),
      amount: carryRequest.senderPayAmount,
      travellerId: carryRequest.travellerId.toString(),
      travelId,
    });

    await session.commitTransaction();

    return res.status(200).json({
      message: "Carry request accepted, pending payment",
      carryRequest,
      notification: notificationData,
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error in acceptCarryRequest:", error);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
};

export const rejectCarryRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: Missing user" });
    }

    const { carryRequestId } = req.body;
    if (!carryRequestId) {
      return res.status(400).json({ message: "carryRequestId is required" });
    }

    const carryRequest = await CarryRequest.findById(carryRequestId);

    if (!carryRequest) {
      return res.status(404).json({ message: "No carry request found" });
    }

    // Determine who is rejecting
    const isTravellerRejecting =
      carryRequest.travellerId.toString() === userId.toString();
    const isSenderRejecting =
      carryRequest.requestedBy.toString() === userId.toString();

    if (!isTravellerRejecting && !isSenderRejecting) {
      return res.status(403).json({
        message: "You are not authorized to reject this request",
      });
    }

    carryRequest.status = "rejected";
    await carryRequest.save();

    // Fetch user names
    const travellerUser = await User.findById(carryRequest.travellerId).select(
      "firstName lastName"
    );
    const senderUser = await User.findById(carryRequest.requestedBy).select(
      "firstName lastName"
    );

    const travellerName = travellerUser
      ? `${travellerUser.firstName} ${travellerUser.lastName}`
      : "Unknown traveller";
    const senderName = senderUser
      ? `${senderUser.firstName} ${senderUser.lastName}`
      : "Unknown sender";

    // Construct payload for socket
    const payload = {
      requestId: carryRequest._id.toString(),
      consignmentId: carryRequest.consignmentId.toString(),
      travellerId: carryRequest.travellerId.toString(),
      requestedBy: carryRequest.requestedBy.toString(),
      travellerName,
      rejectedById: userId.toString(),
      rejectedByName: isTravellerRejecting ? travellerName : senderName, // FIXED
      status: "rejected" as const,
      senderPayAmount: carryRequest.senderPayAmount,
      travellerEarning: carryRequest.travellerEarning,
    };

    // Notification for the **other party**
    const targetUserId = isTravellerRejecting
      ? carryRequest.requestedBy.toString()
      : carryRequest.travellerId.toString();

    await Notification.create({
      userId: targetUserId,
      title: "Carry request update",
      message: `${
        isTravellerRejecting ? travellerName : senderName
      } has rejected your carry request`,
      typeOfNotif: "consignment",
      relatedConsignmentId: carryRequest.consignmentId,
      requestId: carryRequest._id,
      isRead: false,
    });

    // Emit to both parties
    await emitCarryRequestRejected(
      carryRequest.travellerId.toString(),
      payload
    );
    await emitCarryRequestRejected(
      carryRequest.requestedBy.toString(),
      payload
    );

    return res.status(200).json({
      message: "Carry request rejected successfully",
      carryRequest,
    });
  } catch (error) {
    console.error("❌ Error in rejecting carry request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTravelConsignmentStatus = async (
  req: AuthRequest,
  res: Response
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const { travelConsignmentId } = req.params;
    const { newStatus, otp } = req.body;

    const travelConsignment = await TravelConsignments.findById(
      travelConsignmentId
    ).session(session);
    if (!travelConsignment) {
      return res.status(404).json({ message: "No travel consignment found" });
    }

    const consignment = await ConsignmentModel.findById(
      travelConsignment.consignmentId
    ).session(session);
    if (!consignment) {
      return res.status(404).json({ message: "No consignment found" });
    }

    const carryRequest = await CarryRequest.findOne({
      consignmentId: travelConsignment.consignmentId,
      travelId: travelConsignment.travelId,
      status: { $in: ["accepted"] },
    }).session(session);

    if (!carryRequest) {
      return res.status(404).json({ message: "Carry request not found" });
    }

    // Fetch Travel to check if travel has started
    const travel = await TravelModel.findById(travelConsignment.travelId);
    if (!travel) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Associated travel not found" });
    }

    if (travel.status !== "ongoing") {
      return res
        .status(400)
        .json({ message: "Cannot update consignment before travel starts" });
    }

    // In transit flow
    if (newStatus === "in_transit") {
      if (travelConsignment.status !== "to_handover") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      const isVerified = otp === travelConsignment.senderOTP;
      if (!isVerified) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      travelConsignment.status = "in_transit";
      consignment.status = "in-transit";
      travelConsignment.pickupTime = new Date();

      await travelConsignment.save({ session });
      await consignment.save({ session });

      const earning = await Earning.create(
        [
          {
            userId: carryRequest.travellerId,
            travelId: travelConsignment.travelId,
            consignmentId: travelConsignment.consignmentId,
            amount: travelConsignment.travellerEarning,
            status: "pending",
            is_withdrawn: false,
          },
        ],
        { session }
      );

      if (!earning) {
        return res
          .status(500)
          .json({ message: "Error in creating earning record" });
      }

      const notifSender = await notificationHelper(
        "consignmentCollected",
        consignment,
        "consignment",
        carryRequest.travellerId
      );
      await Notification.create(
        [
          {
            userId: consignment.senderId,
            ...notifSender,
            relatedConsignmentId: consignment._id,
            relatedTravelId: travelConsignment.travelId,
          },
        ],
        { session }
      );

      // EMIT socket event
      // Notify sender
      await emitConsignmentCollected(consignment.senderId.toString(), {
        travelConsignmentId: travelConsignment._id.toString(),
        consignmentId: consignment._id.toString(),
        travelId: travelConsignment.travelId.toString(),
        status: "in_transit",
        pickupTime: travelConsignment.pickupTime.toISOString(),
        travellerEarning: travelConsignment.travellerEarning,
        senderToPay: travelConsignment.senderToPay,
        message: "Consignment picked up and now in transit.",
      });

      // Notify traveller
      await emitConsignmentCollected(carryRequest.travellerId.toString(), {
        travelConsignmentId: travelConsignment._id.toString(),
        consignmentId: consignment._id.toString(),
        travelId: travelConsignment.travelId.toString(),
        status: "in_transit",
        pickupTime: travelConsignment.pickupTime.toISOString(),
        travellerEarning: travelConsignment.travellerEarning,
        senderToPay: travelConsignment.senderToPay,
        message: "Pickup confirmed! Consignment in transit.",
      });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        message: "Status updated to in_transit and earning record created",
        travelConsignment,
        earning,
      });

      // Delivered flow
    } else if (newStatus === "delivered") {
      if (travelConsignment.status !== "in_transit") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      const isVerified = otp === travelConsignment.receiverOTP;
      if (!isVerified) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      travelConsignment.status = "delivered";
      consignment.status = "delivered";
      travelConsignment.deliveryTime = new Date();

      await travelConsignment.save({ session });
      await consignment.save({ session });

      // ✅ Update earning to completed
      await Earning.findOneAndUpdate(
        {
          userId: carryRequest.travellerId,
          consignmentId: consignment._id,
          status: "pending",
        },
        { status: "completed" },
        { session }
      );

      const notifSender = await notificationHelper(
        "consignmentDelivered",
        consignment,
        "consignment",
        carryRequest.travellerId
      );
      await Notification.create(
        [
          {
            userId: consignment.senderId,
            ...notifSender,
            relatedConsignmentId: consignment._id,
            relatedTravelId: travelConsignment.travelId,
          },
        ],
        { session }
      );

      // EMIT socket event

      // Notify sender
      await emitConsignmentDelivered(consignment.senderId.toString(), {
        travelConsignmentId: travelConsignment._id.toString(),
        consignmentId: consignment._id.toString(),
        travelId: travelConsignment.travelId.toString(),
        status: "delivered",
        deliveryTime: travelConsignment.deliveryTime.toISOString(),
        message:
          "Delivered successfully! Consignment has been delivered successfully.",
      });

      // Notify traveller
      await emitConsignmentDelivered(carryRequest.travellerId.toString(), {
        travelConsignmentId: travelConsignment._id.toString(),
        consignmentId: consignment._id.toString(),
        travelId: travelConsignment.travelId.toString(),
        status: "delivered",
        deliveryTime: travelConsignment.deliveryTime.toISOString(),
        message: "Delivery successful! Your earning has been recorded.",
      });

      await session.commitTransaction();
      session.endSession();

      return res
        .status(200)
        .json({ message: "Status updated to delivered", travelConsignment });
    } else {
      return res.status(400).json({ message: "Invalid newStatus value" });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error in updating travel consignment status:", error);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
};
