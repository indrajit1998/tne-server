import type { Response } from "express";
import mongoose from "mongoose";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";
import { formatCoordinates } from "../../lib/utils";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import ConsignmentModel from "../../models/consignment.model";
import { TravelModel } from "../../models/travel.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { User } from "../../models/user.model";

export const getTravelConsignmentById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { travelConsignmentId } = req.params;
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    if (
      !travelConsignmentId ||
      !mongoose.Types.ObjectId.isValid(travelConsignmentId)
    ) {
      return res.status(400).json({ message: "Invalid travelConsignmentId" });
    }

    const travelConsignment = await TravelConsignments.findById(
      travelConsignmentId
    )
      .populate("consignmentId")
      .populate("travelId")
      .lean();

    if (!travelConsignment) {
      return res
        .status(CODES.NOT_FOUND)
        .json(
          sendResponse(CODES.NOT_FOUND, null, "Travel consignment not found")
        );
    }

    const consignment = travelConsignment.consignmentId as any;
    const travel = travelConsignment.travelId as any;

    if (!consignment || !travel) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "Invalid linked travel or consignment"
          )
        );
    }

    const sender = await User.findById(consignment.senderId).select(
      "firstName lastName phoneNumber profilePictureUrl"
    );

    const traveller = await User.findById(travel.travelerId).select(
      "firstName lastName phoneNumber profilePictureUrl"
    );

    // ✅ Coordinate formatting for FE convenience
    const formattedConsignment = {
      ...consignment,
      fromCoordinates: formatCoordinates(consignment.fromCoordinates),
      toCoordinates: formatCoordinates(consignment.toCoordinates),
    };

    const formattedTravel = {
      ...travel,
      fromCoordinates: formatCoordinates(travel.fromCoordinates),
      toCoordinates: formatCoordinates(travel.toCoordinates),
    };

    // Conditional OTP visibility logic
    let senderOTP: string | null = null;
    let receiverOTP: string | null = null;

    if (String(userId) === String(consignment.senderId)) {
      // Sender can always see pickup OTP
      senderOTP = travelConsignment.senderOTP;

      // Sender can see receiver OTP only after pickup (i.e. status = in_transit or delivered)
      if (
        travelConsignment.status === "in_transit" ||
        travelConsignment.status === "delivered"
      ) {
        receiverOTP = travelConsignment.receiverOTP;
      }
    }

    // Traveller never gets OTPs
    // Other users also don’t get OTPs
    const responseData = {
      _id: travelConsignment._id,
      status: travelConsignment.status,
      pickupTime: travelConsignment.pickupTime,
      deliveryTime: travelConsignment.deliveryTime,
      travellerEarning: travelConsignment.travellerEarning,
      senderToPay: travelConsignment.senderToPay,
      senderOTP,
      receiverOTP,
      consignment: formattedConsignment,
      travel: formattedTravel,
      sender,
      traveller,
    };

    return res
      .status(CODES.OK)
      .json(
        sendResponse(
          CODES.OK,
          responseData,
          "Travel consignment fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching travel consignment:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Something went wrong while fetching travel consignment"
        )
      );
  }
};

export const getTravelConsignments = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user;
    const { role, status, travelId } = req.query;

    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(
          sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized: Missing user")
        );
    }

    if (!role || !["traveller", "sender"].includes(String(role))) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Invalid role value"));
    }

    const filter: any = {};
    if (status) filter.status = status;

    // 🚶 Traveller side
    if (role === "traveller") {
      const travels = await TravelModel.find({ travelerId: userId })
        .select("_id")
        .lean();
      const travelIds = travels.map((t) => t._id);

      if (travelId) {
        if (!mongoose.Types.ObjectId.isValid(String(travelId))) {
          return res
            .status(CODES.BAD_REQUEST)
            .json(sendResponse(CODES.BAD_REQUEST, null, "Invalid travelId"));
        }
        filter.travelId = new mongoose.Types.ObjectId(String(travelId));
      } else {
        filter.travelId = { $in: travelIds };
      }
    }

    // 📦 Sender side
    if (role === "sender") {
      const consignments = await ConsignmentModel.find({ senderId: userId })
        .select("_id")
        .lean();
      const consignmentIds = consignments.map((c) => c._id);
      filter.consignmentId = { $in: consignmentIds };
    }

    const travelConsignments = await TravelConsignments.find(filter)
      .populate({
        path: "consignmentId",
        select: `
      fromAddress
      toAddress
      fromCoordinates
      toCoordinates
      distance
      weight
      weightUnit
      dimensions
      flightPrice
      trainPrice
      roadWaysPrice
      status
      senderId
      receiverName
      receiverPhone
      category
      description
      images
      fragile
      insurance
      pickupTime
      deliveryTime
    `,
      })
      .populate({
        path: "travelId",
        select: `
      fromAddress
      toAddress
      fromCoordinates
      toCoordinates
      modeOfTravel
      expectedStartDate
      expectedEndDate
      durationOfTravel
      durationOfStay
      status
      travelerId
      vehicleType
      vehicleNumber
      createdAt
      updatedAt
    `,
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!travelConsignments.length) {
      return res
        .status(CODES.OK)
        .json(sendResponse(CODES.OK, [], "No travel consignments found"));
    }

    const formatted = await Promise.all(
      travelConsignments.map(async (tc) => {
        const consignment = tc.consignmentId as any;
        const travel = tc.travelId as any;

        const sender = await User.findById(consignment.senderId)
          .select("firstName lastName phoneNumber profilePictureUrl")
          .lean();

        const traveller = await User.findById(travel.travelerId)
          .select("firstName lastName phoneNumber profilePictureUrl")
          .lean();

        return {
          _id: tc._id,
          status: tc.status,
          pickupTime: tc.pickupTime,
          deliveryTime: tc.deliveryTime,
          travellerEarning: tc.travellerEarning,
          senderToPay: tc.senderToPay,
          consignment: {
            ...consignment,
            fromCoordinates: formatCoordinates(consignment.fromCoordinates),
            toCoordinates: formatCoordinates(consignment.toCoordinates),
          },
          travel: {
            ...travel,
            fromCoordinates: formatCoordinates(travel.fromCoordinates),
            toCoordinates: formatCoordinates(travel.toCoordinates),
          },
          sender,
          traveller,
        };
      })
    );

    return res
      .status(CODES.OK)
      .json(
        sendResponse(
          CODES.OK,
          formatted,
          "Travel consignments fetched successfully"
        )
      );
  } catch (error) {
    console.error("❌ Error fetching travel consignments:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Internal server error while fetching travel consignments"
        )
      );
  }
};
