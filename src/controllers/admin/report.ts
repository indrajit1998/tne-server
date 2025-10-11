import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import type { Response } from "express";
import ConsignmentModel from "../../models/consignment.model";

export const getTravellerReport = async (req: AdminAuthRequest, res: Response) => {
  try {

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    
    const stats = await CarryRequest.aggregate([
      { $match: { status: "accepted" } },

      {
        $group: {
          _id: "$travellerId",
          totalEarnings: { $sum: "$travellerEarning" },
          consignmentCount: { $sum: 1 },
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "traveller",
        },
      },

      { $unwind: "$traveller" },

      {
        $project: {
          _id: 0,
          travellerId: "$_id",
          name: "$traveller.firstName",
          email: "$traveller.email",
          phone: "$traveller.phoneNumber",
          consignmentCount: 1,
          totalEarnings: 1,
        },
      },

      { $sort: { totalEarnings: -1 } },

      // Apply pagination
      { $skip: skip },
      { $limit: limit },
    ]);
    const totalTravellers = await CarryRequest.distinct("travellerId", { status: "accepted" });
    const totalPages = Math.ceil(totalTravellers.length / limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalTravellers: totalTravellers.length,
      stats,
    });
  } catch (err) {
    console.error("Error fetching traveller stats:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error while fetching traveller stats",
    });
  }
};



export const getSenderReport = async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const stats = await ConsignmentModel.aggregate([
      
      { $match: { status: "delivered" } },

      {
        $lookup: {
          from: "carryrequests",
          localField: "_id",
          foreignField: "consignmentId",
          as: "carryRequests",
        },
      },

      { $unwind: { path: "$carryRequests", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$senderId",
          consignmentCount: { $sum: 1 },
          totalPaid: { $sum: { $ifNull: ["$carryRequests.senderPayAmount", 0] } },
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "sender",
        },
      },

      { $unwind: "$sender" },

      {
        $project: {
          _id: 0,
          senderId: "$_id",
          name: "$sender.firstName",
          email: "$sender.email",
          phone: "$sender.phoneNumber",
          consignmentCount: 1,
          totalPaid: 1,
        },
      },

      { $sort: { totalPaid: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalSenders = await ConsignmentModel.distinct("senderId", { status: "delivered" });
    const totalPages = Math.ceil(totalSenders.length / limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalSenders: totalSenders.length,
      stats,
    });
  } catch (error) {
    console.error("Error fetching sender report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error while fetching sender report",
    });
  }
};
