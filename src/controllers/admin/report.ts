import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import type { Response } from "express";

export const getTravellerReport = async (req: AdminAuthRequest, res: Response) => {
  try {
    // Parse pagination query params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Main aggregation pipeline
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

    // Get total number of distinct travellers for pagination metadata
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
