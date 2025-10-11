import type { Response } from "express";

import { Types } from "mongoose";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import ConsignmentModel from "../../models/consignment.model";

import mongoose from "mongoose";
import { notificationHelper } from "../../constants/constant";
import logger from "../../lib/logger";
import {
  calculateFlightFare,
  calculateTrainFare,
} from "../../lib/pricingLogic";
import {
  calculateSenderPay,
  calculateTravellerEarning,
  calculateVolumetricWeight,
  generateOtp,
} from "../../lib/utils";
import { Address } from "../../models/address.model";
import { CarryRequest } from "../../models/carryRequest.model";
import Earning from "../../models/earning.model";
import Notification from "../../models/notification.model";
import Payment from "../../models/payment.model";
import { TravelModel } from "../../models/travel.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { User } from "../../models/user.model";
import { getDistance } from "../../services/maps.service";
import { createRazorpayContactId } from "../../services/razorpay.service";

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
    const volumetricWeight = calculateVolumetricWeight(
      dimensions.length,
      dimensions.width,
      dimensions.height,
      dimensions.unit || "cm"
    );
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

    // Define start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

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
      senderPayAmount: senderPay,
      travellerEarning: travellerEarning,
    });
    if (!carryRequestBySender) {
      return res
        .status(500)
        .json({ message: "Error in creating carry request" });
    }
    const notificationData = notificationHelper(
      "bySender",
      { description: consignment.description },
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
      status: "pending",
      senderPayAmount: senderPay,
      travellerEarning: travellerEarning,
    });
    if (!carryRequestByTraveller) {
      return res
        .status(500)
        .json({ message: "Error in creating carry request" });
    }
    const notificationData = notificationHelper(
      "byTraveller",
      { description: consignment.description },
      travel.travelerId
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
  try {
    const { carryRequestId, travelId } = req.body;
    if (!carryRequestId) {
      return res.status(400).json({ message: "carryRequestId is required" });
    }
    const carryRequest = await CarryRequest.findById(carryRequestId);
    if (!carryRequest) {
      return res.status(404).json({ message: "No carry request found" });
    }
    const consignment = await ConsignmentModel.findById(
      carryRequest.consignmentId
    );
    if (!consignment) {
      return res.status(404).json({ message: "No consignment found" });
    }
    const receiverPhone = consignment.receiverPhone;
    const sender = await User.findById(consignment.senderId);
    if (!sender) {
      return res.status(404).json({ message: "No sender found" });
    }
    const senderPhone = sender.phoneNumber;
    const senderName = sender.firstName;
    const senderEmail = sender.email;

    const [otpForSender, otpForReceiver] = await Promise.all([
      generateOtp(senderPhone || ""),
      generateOtp(receiverPhone || ""),
    ]);

    console.log("Receiver OTP:", otpForReceiver.otp);
    console.log("Sender OTP:", otpForSender.otp);

    carryRequest.status = "accepted";
    await carryRequest.save();
    if (!carryRequest) {
      return res
        .status(500)
        .json({ message: "Error in accepting carry request" });
    }
    const travelconsignments = await TravelConsignments.create({
      travelId: travelId,
      consignmentId: carryRequest.consignmentId,
      senderOTP: otpForSender.otp,
      receiverOTP: otpForReceiver.otp,
      status: "to_handover",
      travellerEarning: carryRequest.travellerEarning,
      senderToPay: carryRequest.senderPayAmount,
      platformCommission:
        carryRequest.senderPayAmount - carryRequest.travellerEarning,
    });
    if (!travelconsignments) {
      return res
        .status(500)
        .json({ message: "Error in creating travel consignment" });
    }
    if (!senderName || !senderEmail || !senderPhone) {
      return res.status(400).json({ message: "Sender details are incomplete" });
    }
    const paymentInitation = await createRazorpayContactId(
      senderName,
      senderEmail,
      senderPhone
    );
    if (!paymentInitation) {
      return res.status(500).json({ message: "Error in initiating payment" });
    }
    const paymentModelInitalization = await Payment.create({
      userId: carryRequest.requestedBy,
      consignmentId: carryRequest.consignmentId,
      travelId: travelId,
      type: "sender_pay",
      amount: carryRequest.senderPayAmount,
      status: "pending",
      razorpayPaymentId: paymentInitation,
    });
    if (!paymentModelInitalization) {
      return res
        .status(500)
        .json({ message: "Error in creating payment model" });
    }
    const notificationData = Notification.create({
      userId: sender._id,
      title: "Carry Request Accepted",
      message: `Your carry request for consignment ${consignment.description} has been accepted. please proceed to payment.`,
      isRead: false,
      relatedConsignmentId: consignment._id,
      requestId: carryRequest._id,
      relatedTravelId: carryRequest.travellerId,
    });
    if (!notificationData) {
      return res
        .status(500)
        .json({ message: "Error in creating notification" });
    }
    console.log(notificationData);
    return res
      .status(200)
      .json({ message: "Carry request accepted successfully", carryRequest });
  } catch (error) {
    console.error("❌ Error in accepting carry request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const rejectCarryRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { carryRequestId } = req.body;
    if (!carryRequestId) {
      return res.status(400).json({ message: "carryRequestId is required" });
    }
    const carryRequest = await CarryRequest.findById(carryRequestId);
    if (!carryRequest) {
      return res.status(404).json({ message: "No carry request found" });
    }
    carryRequest.status = "rejected";
    await carryRequest.save();
    return res
      .status(200)
      .json({ message: "Carry request rejected successfully", carryRequest });
  } catch (error) {
    console.error("❌ Error in rejecting carry request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTravelConsignmentStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { travelConsignmentId } = req.params;
    const { newStatus, otp } = req.body;
    const travelConsignment = await TravelConsignments.findById(
      travelConsignmentId
    );
    if (!travelConsignment) {
      return res.status(404).json({ message: "No travel consignment found" });
    }
    const consignment = await ConsignmentModel.findById(
      travelConsignment.consignmentId
    );
    if (!consignment) {
      return res.status(404).json({ message: "No consignment found" });
    }
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
      await consignment.save();
      travelConsignment.pickupTime = new Date();
      await travelConsignment.save();
      const earning = Earning.create({
        userId: travelConsignment.travelId,
        travelId: travelConsignment.travelId,
        consignmentId: travelConsignment.consignmentId,
        amount: travelConsignment.travellerEarning,
        status: "pending",
        is_withdrawn: false,
      });
      if (!earning) {
        return res
          .status(500)
          .json({ message: "Error in creating earning record" });
      }

      return res.status(200).json({
        message: "Status updated to in_transit and earning record created",
        travelConsignment,
        earning,
      });
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
      await consignment.save();
      travelConsignment.deliveryTime = new Date();
      await travelConsignment.save();
      return res
        .status(200)
        .json({ message: "Status updated to delivered", travelConsignment });
    } else {
      return res.status(400).json({ message: "Invalid newStatus value" });
    }
  } catch (error) {
    console.error("❌ Error in updating travel consignment status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
