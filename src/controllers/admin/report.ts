import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import type { Response } from "express";


export const getTravellerReport = async (req:AdminAuthRequest, res:Response) => {
  try {
    const stats = await CarryRequest.aggregate([
      // Only include accepted requests (optional)
      { $match: { status: "accepted" } },

      // Group by travellerId
      {
        $group: {
          _id: "$travellerId",
          totalEarnings: { $sum: "$travellerEarning" },
          consignmentCount: { $sum: 1 },
        },
      },

      // Lookup traveller details from User collection
      {
        $lookup: {
          from: "users", // collection name in MongoDB
          localField: "_id",
          foreignField: "_id",
          as: "traveller",
        },
      },

      // Flatten traveller details
      { $unwind: "$traveller" },

      // Project clean output
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

      // Optional: sort by top earners
      { $sort: { totalEarnings: -1 } },
    ]);

    res.status(200).json({ success: true, stats });
  } catch (err) {
    console.error("Error fetching traveller stats:", err);
    res.status(500).json({ success: false, message: "Internal Server Error while fetching traveller stats" });
  }
};
