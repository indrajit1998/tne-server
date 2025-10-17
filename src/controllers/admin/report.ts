import type { Response } from "express";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import ConsignmentModel from "../../models/consignment.model";
import Payment from "../../models/payment.model";
import { User as UserModel } from "../../models/user.model";
import TravelConsignments from "../../models/travelconsignments.model";

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


export const getConsolidateConsignment = async (req: AdminAuthRequest, res: Response) => {
  try {
    const stats = await CarryRequest.find({})
      .populate({
        path: "consignmentId",
        select: "senderId status createdAt",
        populate: {
          path: "senderId",
          select: "firstName lastName phoneNumber email",
        },
      })
      .populate({
        path: "travellerId",
        select: "firstName lastName email phoneNumber",
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: stats.length,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching consolidated consignment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error while fetching consolidated consignment",
    });
  }
};


export const getSenderReport = async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const stats = await ConsignmentModel.aggregate([
      
      //{ $match: { status: "delivered" } },

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

export const getSalesReport = async (req: AdminAuthRequest, res: Response) => {
  try {
    const { period, fromDate, toDate } = req.query;
    const dateFilter: { createdAt?: { $gte?: Date; $lte?: Date } } = {};

    if (period === "weekly") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      dateFilter.createdAt = { $gte: oneWeekAgo };
    } else if (period === "monthly") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      dateFilter.createdAt = { $gte: oneMonthAgo };
    } else if (period === "yearly") {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      dateFilter.createdAt = { $gte: oneYearAgo };
    } else if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate as string),
        $lte: new Date(toDate as string),
      };
    }

    const pipeline = [
      { $match: { status: "completed", ...dateFilter } },
      
      
      {
        $lookup: {
          from: "travels",
          localField: "travelId",
          foreignField: "_id",
          as: "travelInfo",
        },
      },
      { $unwind: { path: "$travelInfo", preserveNullAndEmptyArrays: true } },

      
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [{ $eq: ["$type", "sender_pay"] }, "$amount", 0] } },
          totalPayouts: { $sum: { $cond: [{ $eq: ["$type", "traveller_earning"] }, "$amount", 0] } },
          // platformCommission: { $sum: { $cond: [{ $eq: ["$type", "platform_commission"] }, "$amount", 0] } }, 
          senderPayCount: { $sum: { $cond: [{ $eq: ["$type", "sender_pay"] }, 1, 0] } },
          travellerEarningCount: { $sum: { $cond: [{ $eq: ["$type", "traveller_earning"] }, 1, 0] } },
          // platformCommissionCount: { $sum: { $cond: [{ $eq: ["$type", "platform_commission"] }, 1, 0] } }, 
          allPayments: { $push: "$$ROOT" }
        }
      },

      
      {
        $project: {
          _id: 0,
          summary: {
            totalRevenue: "$totalRevenue",
            totalPayouts: "$totalPayouts",
            // platformCommission: "$platformCommission",
            netRevenue: { $subtract: ["$totalRevenue", "$totalPayouts"] },
            totalTransactions: { $size: "$allPayments" },
            senderPayCount: "$senderPayCount",
            travellerEarningCount: "$travellerEarningCount",
            // platformCommissionCount: "$platformCommissionCount", 
          },
          regionBreakdown: {
            sender_pay: {
              $filter: {
                input: "$allPayments", as: "payment", cond: { $eq: ["$$payment.type", "sender_pay"] }
              }
            },
            traveller_earning: {
              $filter: {
                input: "$allPayments", as: "payment", cond: { $eq: ["$$payment.type", "traveller_earning"] }
              }
            },
            // platform_commission: { 
            //   $filter: {
            //     input: "$allPayments", as: "payment", cond: { $eq: ["$$payment.type", "platform_commission"] }
            //   }
            // }
          }
        }
      },
      
      {
        $project:{
          summary:1,
          "regionBreakdown.sender_pay": {
            $map: {
              input: "$regionBreakdown.sender_pay",
              as: "p",
              in: { 
              
                region: { $concat: ["$$p.travelInfo.fromAddress.city", ", ", "$$p.travelInfo.fromAddress.state"] }, 
                totalAmount: "$$p.amount",
                
                modeOfTravel: "$$p.travelInfo.modeOfTravel" 
              }
            }
          },
          "regionBreakdown.traveller_earning": {
            $map: {
              input: "$regionBreakdown.traveller_earning",
              as: "p",
              in: { 
                region: { $concat: ["$$p.travelInfo.fromAddress.city", ", ", "$$p.travelInfo.fromAddress.state"] }, 
                totalAmount: "$$p.amount",
                
                modeOfTravel: "$$p.travelInfo.modeOfTravel"
              }
            }
          },
          // "regionBreakdown.platform_commission": { 
          //   $map: {
          //     input: "$regionBreakdown.platform_commission",
          //     as: "p",
          //     in: { 
          //       region: { $concat: ["$$p.travelInfo.fromAddress.city", ", ", "$$p.travelInfo.fromAddress.state"] }, 
          //       totalAmount: "$$p.amount",
          //       modeOfTravel: "$$p.travelInfo.modeOfTravel"
          //     }
          //   }
          // }
        }
      }
    ];

    const results = await Payment.aggregate(pipeline);

    const data = results[0] || {
      summary: {
        totalRevenue: 0, totalPayouts: 0, /* platformCommission: 0,*/ netRevenue: 0, 
        totalTransactions: 0, senderPayCount: 0, travellerEarningCount: 0, /* platformCommissionCount: 0,*/
      },
      regionBreakdown: { sender_pay: [], traveller_earning: [], /* platform_commission: []*/ } 
    };

    res.status(200).json({ success: true, data });

  } catch (error) {
    console.error("Error fetching sales report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error while fetching sales report",
    });
  }
};


export const getSenderConsignmentDetails = async (
  req: AdminAuthRequest,
  res: Response
) => {
  try {
    const { senderPhone } = req.params;

    // 1. Find the sender by phone number to get their ID
    const sender = await UserModel.findOne({ phoneNumber: senderPhone })
      .select("_id")
      .lean();

    if (!sender) {
      return res.status(404).json({
        success: false,
        message: "Sender not found with the provided phone number.",
      });
    }

    const senderId = sender._id;

    // 2. Use an aggregation pipeline to gather all required details
    const consignments = await ConsignmentModel.aggregate([
      // Stage 1: Find all consignments from this sender
      {
        $match: {
          senderId: senderId,
        },
      },
      // Stage 2: Join with TravelConsignments to get earnings and specific status
      {
        $lookup: {
          from: "travelconsignments", // Note: This is the MongoDB collection name
          localField: "_id",
          foreignField: "consignmentId",
          as: "travelConsignmentInfo",
        },
      },
      // Deconstruct the array from the lookup
      {
        $unwind: {
          path: "$travelConsignmentInfo",
          preserveNullAndEmptyArrays: true, // Keep consignments that aren't in a travel yet
        },
      },
      // Stage 3: Join with Payments to get payment status
      {
        $lookup: {
          from: "payments", // Note: This is the MongoDB collection name
          localField: "_id",
          foreignField: "consignmentId",
          pipeline: [{ $match: { type: "sender_pay" } }], // Get only the sender payment record
          as: "paymentInfo",
        },
      },
      // Deconstruct the array from the lookup
      {
        $unwind: {
          path: "$paymentInfo",
          preserveNullAndEmptyArrays: true, // Keep consignments without a payment record
        },
      },
      // Stage 4: Shape the final output to match the frontend table
      {
        $project: {
          _id: 0, // Exclude the default _id field
          consignmentId: "$_id",
          startingLocation: "$fromAddress.city",
          endingLocation: "$toAddress.city",
          paymentStatus: {
            $cond: {
                if: { $eq: ["$paymentInfo.status", "completed"] },
                then: "Paid",
                else: { $ifNull: [ "$paymentInfo.status", "Pending" ] } // Show 'pending' or 'failed' if present
            }
          },
          consignmentStatus: {
            $ifNull: ["$travelConsignmentInfo.status", "$status"],
          }, // Prioritize the more specific status
          dateOfSending: "$sendingDate",
          weight: {
            $concat: [{ $toString: "$weight" }, " ", "$weightUnit"],
          },
          receiverName: "$receiverName",
          receiverPhone: "$receiverPhone",
          earnings: { $ifNull: ["$travelConsignmentInfo.travellerEarning", 0] },
        },
      },
      // Stage 5: Sort by most recent consignments
      { $sort: { dateOfSending: -1 } },
    ]);

    if (!consignments || consignments.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No consignments found for this sender.",
        data: [], // Send empty array for frontend to handle
      });
    }

    // 3. Send the successful response
    res.status(200).json({
      success: true,
      count: consignments.length,
      data: consignments,
    });
  } catch (error) {
    console.error("Error fetching sender consignment details:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error while fetching sender consignment details",
    });
  }
};


import { TravelModel } from "../../models/travel.model"; 

export const getTravelerConsignmentDetails = async (
  req: AdminAuthRequest,
  res: Response
) => {
  try {
    const { travelerPhone } = req.params;

    // Step 1: Find the User and get their ID.
    const traveler = await UserModel.findOne({ phoneNumber: travelerPhone })
      .select("_id")
      .lean();

    if (!traveler) {
      return res.status(404).json({
        success: false,
        message: "Traveler not found.",
      });
    }
    const travelerId = traveler._id;

    // Step 2: Get a definitive list of all Travel IDs associated with this traveler.
    // We use .distinct() for an efficient, flat array of IDs.
    const travelIds = await TravelModel.distinct('_id', { travelerId: travelerId });

    // If the traveler has never created a travel plan, we can stop here.
    if (travelIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "This traveler has no travel plans."
      });
    }

    // Step 3: Now, run an aggregation on TravelConsignments using our trusted list of travelIds.
    const consignments = await TravelConsignments.aggregate([
      // Stage 1: The crucial match. Only consider consignments linked to the traveler's actual travels.
      {
        $match: {
          travelId: { $in: travelIds },
        },
      },

      // Stage 2: Get the full details for each consignment.
      {
        $lookup: {
          from: "consignments",
          localField: "consignmentId",
          foreignField: "_id",
          as: "consignmentDetails",
        },
      },
      {
        $unwind: "$consignmentDetails",
      },

      // Stage 3: Get the payment status for the traveler's earning.
      {
        $lookup: {
          from: "payments",
          let: { consignment_id: "$consignmentId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$consignmentId", "$$consignment_id"] },
                    { $eq: ["$userId", travelerId] },
                    { $eq: ["$type", "traveller_earning"] },
                  ],
                },
              },
            },
          ],
          as: "paymentDetails",
        },
      },
      {
        $unwind: {
          path: "$paymentDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Stage 4: Format the final output to match the frontend modal.
      {
        $project: {
          _id: 0,
          consignmentId: "$consignmentDetails._id",
          status: "$status",
          paymentStatus: {
             $cond: {
                if: { $eq: ["$paymentDetails.status", "completed"] },
                then: "Paid",
                else: { $ifNull: [ "$paymentDetails.status", "Pending" ] }
            }
          },
          weight: {
            $concat: [
              { $toString: "$consignmentDetails.weight" }, " ", "$consignmentDetails.weightUnit",
            ],
          },
          pickup: "$consignmentDetails.fromAddress.city",
          drop: "$consignmentDetails.toAddress.city",
          travelDate: "$consignmentDetails.sendingDate",
          earnings: "$travellerEarning",
        },
      },
      { $sort: { travelDate: -1 } },
    ]);

    // Final response
    res.status(200).json({
      success: true,
      count: consignments.length,
      data: consignments,
    });
  } catch (error) {
    console.error("Error fetching traveler consignment details:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal Server Error while fetching traveler consignment details",
    });
  }
};