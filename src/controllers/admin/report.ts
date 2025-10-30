import type { Response } from "express";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import ConsignmentModel from "../../models/consignment.model";
import Payment from "../../models/payment.model";
import { User as UserModel } from "../../models/user.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { TravelModel } from "../../models/travel.model";
import Earning from "../../models/earning.model";
import FareConfigModel from "../../models/fareconfig.model";
import mongoose, { type PipelineStage } from "mongoose";


export const getConsolidateConsignment = async (req: AdminAuthRequest, res: Response) => {
 try {

   // --- Fetch Fare Configuration First ---
   const config = await FareConfigModel.findOne().lean();
   const gstRate = config?.gst || 0;
   const marginRate = (config?.margin || 0) * 100; // Convert to percentage
   const teFee = config?.TE || 0;


   const basePipeline: PipelineStage[] = [
     {
       $lookup: { 
         from: "consignments",
         localField: "consignmentId",
         foreignField: "_id",
         as: "consignmentInfo",
       },
     },
     { $unwind: "$consignmentInfo" },
     {
       $lookup: { 
         from: "users",
         localField: "consignmentInfo.senderId",
         foreignField: "_id",
         as: "senderInfo",
       },
     },
     { $unwind: "$senderInfo" },
     {
       $lookup: { 
         from: "travels",
         localField: "travelId",
         foreignField: "_id",
         as: "travelInfo",
       },
     },
     { $unwind: "$travelInfo" },
     {
       $lookup: { 
         from: "users",
         localField: "travelInfo.travelerId",
         foreignField: "_id",
         as: "travellerInfo",
       },
     },
     { $unwind: "$travellerInfo" },
     {
      $addFields: {
        "originalBaseTotal": {
          $divide: [
            "$senderToPay", // This is the Final Total (e.g., 1120.56)
            { 
              $add: [
                1, 
                { $divide: [marginRate, 100] }, // ex: The 20%
                { $divide: [gstRate, 100] }     // ex: The 18%
              ] 
            } // This results in ex: 1.38
          ]
        }
      }
    },

    {
      $project: {
        _id: 0,
        
        // ... (All your other fields remain the same)
        consignmentId: { $toString: "$consignmentInfo._id" }, 
        senderName: { $concat: ["$senderInfo.firstName", " ", "$senderInfo.lastName"] },
        senderPhone: "$senderInfo.phoneNumber",
        senderEmail: "$senderInfo.email",
        travellerName: { $concat: ["$travellerInfo.firstName", " ", "$travellerInfo.lastName"] },
        travellerPhone: "$travellerInfo.phoneNumber",
        travellerEmail: "$travellerInfo.email",
        fromCity: "$consignmentInfo.fromAddress.city",
        toCity: "$consignmentInfo.toAddress.city",
        sendingDate: "$consignmentInfo.sendingDate",
        consignmentStatus: "$consignmentInfo.status",
        travelConsignmentStatus: "$status", 
        senderPaid: "$senderToPay",
        travellerEarned: "$travellerEarning",
        pickupTime: "$pickupTime",
        deliveryTime: "$deliveryTime",
        createdAt: "$createdAt",
        modeOfTravel: "$travelInfo.modeOfTravel",
        
        // --- CORRECTED CALCULATIONS ---
        
        // This is the true base amount (e.g., 812)
        originalBaseTotal: "$originalBaseTotal",

        // Correct GST: Base Total * 18%
        gstAmount: { 
          $multiply: [ 
            "$originalBaseTotal", 
            { $divide: [gstRate, 100] } 
         ]
        },
        
        // Correct Margin: Base Total * 20%
        marginAmount: {
          $multiply: [
            "$originalBaseTotal",
            { $divide: [marginRate, 100] }
          ]
        },
        
        travelAndEarnFee: { $literal: teFee },
        
        // This now correctly uses the originalBaseTotal
        remainingAmount: {
          $subtract: [
            { $subtract: [
                { $subtract: [ "$originalBaseTotal", "$marginAmount" ] }, // (Base - Margin)
                { $literal: teFee } // - teFee
            ] },
            "$travellerEarning" // - travellerEarning
          ]
        }
      },
    },
     { $sort: { createdAt: -1 } },
   ];
   const stats = await TravelConsignments.aggregate(basePipeline);

   const totalConsignments = stats.length;

   return res.status(200).json({
     success: true,
     total: totalConsignments,
     // --- REMOVED: currentPage and totalPages ---
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
        const search = (req.query.search as string) || "";

        // Base aggregation pipeline
        const basePipeline :PipelineStage[]= [
            // Stage 1: Match consignments (Optional: uncomment to filter by status)
            // { 
            //     $match: { status: "delivered" } 
            // },
            
            // Stage 2: Lookup ALL carry requests for each consignment
            {
                $lookup: {
                    from: "carryrequests",
                    localField: "_id",
                    foreignField: "consignmentId",
                    as: "carryRequests",
                },
            },

            // --- *** THE FIX *** ---
            // Stage 3: Project and find the ONE relevant carry request.
            // We do this *before* grouping to avoid fanning out.
            {
                $project: {
                    senderId: 1, // Keep the senderId
                    // Find the first request that is "accepted" or "accepted_pending_payment"
                    relevantRequest: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: "$carryRequests",
                                    as: "req",
                                    cond: { 
                                        $in: ["$$req.status", ["accepted", "accepted_pending_payment"]]
                                    }
                                }
                            }, 0 // Get the first matching element
                        ]
                    }
                }
            },
            
            // Stage 4: Group by senderId
            {
                $group: {
                    _id: "$senderId",
                    // This now correctly counts 1 per consignment (e.g., 19)
                    consignmentCount: { $sum: 1 }, 
                    // This now correctly sums only the senderPayAmount from the relevant request
                    totalPaid: { $sum: { $ifNull: ["$relevantRequest.senderPayAmount", 0] } },
                },
            },
            
            // Stage 5: Lookup user details
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "sender",
                },
            },
            // Stage 6: Unwind the sender (filters out orphan senders)
            { $unwind: "$sender" },

            // Stage 7: Apply search filter
            {
                $match: search ? {
                    $or: [
                        { 'sender.firstName': { $regex: search, $options: 'i' } },
                        { 'sender.lastName': { $regex: search, $options: 'i' } },
                        { 'sender.email': { $regex: search, $options: 'i' } },
                        { 'sender.phoneNumber': { $regex: search, $options: 'i' } },
                    ]
                } : {}
            },

            // Stage 8: Project the final output
            {
                $project: {
                    _id: 0,
                    senderId: { $toString: "$_id" },
                    name: { $concat: ["$sender.firstName", " ", "$sender.lastName"] },
                    email: "$sender.email",
                    phone: "$sender.phoneNumber",
                    consignmentCount: 1,
                    totalPaid: 1,
                },
            },
            // Stage 9: Sort
            { $sort: { totalPaid: -1 } },
        ];

        // --- Execute Aggregations for Count and Data ---
        const countPipeline = [...basePipeline, { $count: "total" }];
        const dataPipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];

        const [totalResult, stats] = await Promise.all([
            ConsignmentModel.aggregate(countPipeline), // Base collection is ConsignmentModel
            ConsignmentModel.aggregate(dataPipeline)
        ]);

        const totalSenders = totalResult[0]?.total || 0;
        const totalPages = Math.ceil(totalSenders / limit);

        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages,
            totalSenders,
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
      const startDate = new Date(fromDate as string);
      startDate.setHours(0, 0, 0, 0); // Start of the day
      const endDate = new Date(toDate as string);
      endDate.setHours(23, 59, 59, 999); // End of the day
      
      dateFilter.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    // 2. Aggregation Pipeline
    // We start from 'TravelConsignments' as it links all the data
    const pipeline: PipelineStage[] = [
      // Filter by "delivered" status and the date range
      { $match: { status: "delivered", ...dateFilter } },

      // Get Travel Info (for modeOfTravel)
      {
        $lookup: {
          from: "travels", // Collection name for TravelModel
          localField: "travelId",
          foreignField: "_id",
          as: "travelInfo",
        },
      },
      { $unwind: { path: "$travelInfo", preserveNullAndEmptyArrays: true } },

      // Get Consignment Info (for region)
      {
        $lookup: {
          from: "consignments", // Collection name for ConsignmentModel
          localField: "consignmentId",
          foreignField: "_id",
          as: "consignmentInfo",
        },
      },
      { $unwind: { path: "$consignmentInfo", preserveNullAndEmptyArrays: true } },

      // Group all matching documents into one
      {
        $group: {
          _id: null,
          // Sum up the amounts from the TravelConsignments schema
          totalRevenue: { $sum: "$senderToPay" },
          totalPayouts: { $sum: "$travellerEarning" },
          platformCommission: { $sum: "$platformCommission" },
          // Count the total number of delivered transactions
          totalTransactionCount: { $sum: 1 },
          // Collect all the joined documents for the region breakdown
          allTransactions: { $push: "$$ROOT" },
        },
      },

      // Project the final structure
      {
        $project: {
          _id: 0,
          // Summary object for the main table
          summary: {
            totalRevenue: { $ifNull: ["$totalRevenue", 0] },
            totalPayouts: { $ifNull: ["$totalPayouts", 0] },
            platformCommission: { $ifNull: ["$platformCommission", 0] },
            // Net revenue is what the platform keeps
            netRevenue: { $subtract: ["$totalRevenue", "$totalPayouts"] },
            // Your frontend expects counts for each type. In this schema,
            // one transaction has all 3 components, so the count is the same.
            senderPayCount: { $ifNull: ["$totalTransactionCount", 0] },
            travellerEarningCount: { $ifNull: ["$totalTransactionCount", 0] },
            platformCommissionCount: { $ifNull: ["$totalTransactionCount", 0] },
            totalTransactions: { $ifNull: ["$totalTransactionCount", 0] },
          },
          // Region breakdown object for the modal
          regionBreakdown: {
            // Data for when "Sender Pay" is clicked
            sender_pay: {
              $map: {
                input: "$allTransactions",
                as: "tx",
                in: {
                  region: {
                    $concat: [
                      { $ifNull: ["$$tx.consignmentInfo.fromAddress.city", "N/A"] },
                      ", ",
                      { $ifNull: ["$$tx.consignmentInfo.fromAddress.state", "N/A"] },
                    ],
                  },
                  modeOfTravel: { $ifNull: ["$$tx.travelInfo.modeOfTravel", "N/A"] },
                  totalAmount: { $ifNull: ["$$tx.senderToPay", 0] },
                },
              },
            },
            // Data for when "Traveller Earning" is clicked
            traveller_earning: {
              $map: {
                input: "$allTransactions",
                as: "tx",
                in: {
                  region: {
                    $concat: [
                      { $ifNull: ["$$tx.consignmentInfo.fromAddress.city", "N/A"] },
                      ", ",
                      { $ifNull: ["$$tx.consignmentInfo.fromAddress.state", "N/A"] },
                    ],
                  },
                  modeOfTravel: { $ifNull: ["$$tx.travelInfo.modeOfTravel", "N/A"] },
                  totalAmount: { $ifNull: ["$$tx.travellerEarning", 0] },
                },
              },
            },
            // Data for when "Platform Commission" is clicked
            platform_commission: {
              $map: {
                input: "$allTransactions",
                as: "tx",
                in: {
                  region: {
                    $concat: [
                      { $ifNull: ["$$tx.consignmentInfo.fromAddress.city", "N/A"] },
                      ", ",
                      { $ifNull: ["$$tx.consignmentInfo.fromAddress.state", "N/A"] },
                    ],
                  },
                  modeOfTravel: { $ifNull: ["$$tx.travelInfo.modeOfTravel", "N/A"] },
                  totalAmount: { $ifNull: ["$$tx.platformCommission", 0] },
                },
              },
            },
          },
        },
      },
    ];

    // 3. Execute Aggregation
    // We run the pipeline on the 'TravelConsignments' model
    const results = await TravelConsignments.aggregate(pipeline);

    // 4. Handle Empty Results
    // This is the default object if no data is found
    const data = results[0] || {
      summary: {
        totalRevenue: 0,
        totalPayouts: 0,
        platformCommission: 0,
        netRevenue: 0,
        totalTransactions: 0,
        senderPayCount: 0,
        travellerEarningCount: 0,
        platformCommissionCount: 0,
      },
      regionBreakdown: {
        sender_pay: [],
        traveller_earning: [],
        platform_commission: [],
      },
    };

    // 5. Send Response (Unchanged)
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
          consignmentStatus:"$status",
          travelConsignmentStatus:
          {
            $ifNull: ["$travelConsignmentInfo.status", "$status"],
          }, 
          dateOfSending: "$sendingDate",
          weight: {
            $concat: [{ $toString: "$weight" }, " ", "$weightUnit"],
          },
          receiverName: "$receiverName",
          receiverPhone: "$receiverPhone",
          earnings: { $ifNull: ["$travelConsignmentInfo.travellerEarning", 0] },
          senderPayAmount: { $ifNull: ["$travelConsignmentInfo.senderToPay", 0]  },
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


export const getTravellerReport = async (req: AdminAuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const search = (req.query.search as string) || "";

        // Base pipeline now starts from TRAVELS
        const basePipeline: PipelineStage[] = [
            // Stage 1: Group all travels by travelerId first
            {
                $group: {
                    _id: "$travelerId",
                    travelIds: { $push: "$_id" } // Collect all travel IDs for this user
                }
            },
            // Stage 2: Lookup user info
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "travelerInfo"
                }
            },
            // Stage 3: Unwind user info (this filters out orphan travels)
            { $unwind: "$travelerInfo" },
            
            // Stage 4: Apply search filter (can now search by user info)
            {
                 $match: search ? {
                    $or: [
                        { 'travelerInfo.firstName': { $regex: search, $options: 'i' } },
                        { 'travelerInfo.lastName': { $regex: search, $options: 'i' } },
                        { 'travelerInfo.email': { $regex: search, $options: 'i' } },
                        { 'travelerInfo.phoneNumber': { $regex: search, $options: 'i' } },
                    ]
                } : {}
            },

            // Stage 5: Lookup ALL travel consignments linked to this user's travels
            {
                $lookup: {
                    from: "travelconsignments",
                    localField: "travelIds", // Use the array of travel IDs
                    foreignField: "travelId",
                    as: "allConsignments" // Get all linked consignments
                }
            },

            // Stage 6: Final Project to calculate counts and earnings
            {
                $project: {
                    _id: 0,
                    travellerId: { $toString: "$_id" },
                    name: { $concat: ["$travelerInfo.firstName", " ", "$travelerInfo.lastName"] },
                    email: "$travelerInfo.email",
                    phone: "$travelerInfo.phoneNumber",

                    // 1. Count ALL consignments
                    consignmentCount: { $size: "$allConsignments" },
                    
                    // 2. Sum earnings ONLY from "delivered" consignments
                    totalEarnings: {
                        $sum: {
                            $map: {
                                input: "$allConsignments",
                                as: "tc",
                                in: {
                                    $cond: [ { $eq: ["$$tc.status", "delivered"] }, "$$tc.travellerEarning", 0 ]
                                }
                            }
                        }
                    }
                }
             },
             // Stage 7: Sort
             { $sort: { totalEarnings: -1, name: 1 } },
        ];

        // --- Execute Aggregations for Count and Data ---
        const countPipeline: PipelineStage[] = [...basePipeline, { $count: "total" }];
        const dataPipeline: PipelineStage[] = [...basePipeline, { $skip: skip }, { $limit: limit }];

        const [totalResult, stats] = await Promise.all([
             TravelModel.aggregate(countPipeline), // Base collection is now TravelModel
             TravelModel.aggregate(dataPipeline)   // Base collection is now TravelModel
        ]);

        const totalTravellers = totalResult[0]?.total || 0;
        const totalPages = Math.ceil(totalTravellers / limit);

        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages,
            totalTravellers, 
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

export const getTravelerConsignmentDetails = async (
  req: AdminAuthRequest,
  res: Response
) => {
  try {
    const { travelerPhone } = req.params;

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

    // This pipeline now starts from Travels
    const results = await TravelModel.aggregate([
      // Stage 1: Find all travels for this user
      {
        $match: {
          travelerId: travelerId,
        },
      },
      // Stage 2: Left-join TravelConsignments
      {
        $lookup: {
          from: "travelconsignments",
          localField: "_id",
          foreignField: "travelId",
          as: "tcInfo",
        },
      },
      // Stage 3: Unwind the results, keeping travels with no consignments
      {
        $unwind: { path: "$tcInfo", preserveNullAndEmptyArrays: true }
      },
      // Stage 4: Left-join Consignment details (if tcInfo exists)
      {
        $lookup: {
          from: "consignments",
          localField: "tcInfo.consignmentId",
          foreignField: "_id",
          as: "consignmentDetails",
        },
      },
      {
        $unwind: { path: "$consignmentDetails", preserveNullAndEmptyArrays: true }
      },
      // Stage 5: Left-join Payment details (if tcInfo exists)
      {
        $lookup: {
          from: "payments",
          let: { consignment_id: "$tcInfo.consignmentId", travel_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$consignmentId", "$$consignment_id"] },
                    { $eq: ["$travelId", "$$travel_id"] },
                    { $eq: ["$userId", travelerId] },
                    { $eq: ["$type", "traveller_earning"] },
                  ],
                },
              },
            },
            { $limit: 1 }
          ],
          as: "paymentDetails",
        },
      },
      {
        $unwind: { path: "$paymentDetails", preserveNullAndEmptyArrays: true },
      },
      // Stage 6: Project the final combined data
      {
        $project: {
          _id: 0,
          travelId: { $toString: "$_id" },
          modeOfTravel: "$modeOfTravel",
          travelStatus: "$status",
          
          // --- Use $ifNull to provide defaults for all consignment/payment fields ---
          consignmentId: { $ifNull: [ { $toString: "$consignmentDetails._id" }, "N/A" ] },
          startingLocation: { $ifNull: [ "$consignmentDetails.fromAddress.city", "N/A" ] },
          endingLocation: { $ifNull: [ "$consignmentDetails.toAddress.city", "N/A" ] },
          paymentStatus: { $ifNull: ["$paymentDetails.status", "N/A"] },
          consignmentStatus: { $ifNull: [ "$consignmentDetails.status", "N/A" ] },
          dateOfSending: { $ifNull: [ "$consignmentDetails.sendingDate", null ] },
          weight: { 
            $ifNull: [ 
              { $concat: [{ $toString: "$consignmentDetails.weight" }, " ", "$consignmentDetails.weightUnit"] }, 
              "N/A" 
            ] 
          },
          receiverName: { $ifNull: [ "$consignmentDetails.receiverName", "N/A" ] },
          receiverPhone: { $ifNull: [ "$consignmentDetails.receiverPhone", "N/A" ] },
          earnings: { $ifNull: [ "$tcInfo.travellerEarning", 0 ] }, // Default earnings to 0
          carryStatus: { $ifNull: [ "$tcInfo.status", "N/A" ] }, // Status from TravelConsignments
        },
      },
      { $sort: { dateOfSending: -1, travelId: -1 } } // Sort by date, then travelId
    ]);
    
    // --- *** LOGIC FIX AS REQUESTED *** ---
    // Calculate the total earnings for "delivered" consignments ONLY.
    const totalDeliveredEarnings = results.reduce((sum, c) => {
        // Use carryStatus, which is the status from TravelConsignments
        if (c.carryStatus === 'delivered') {
            return sum + (c.earnings || 0);
        }
        return sum;
    }, 0);

    // The modal's 'Total Consignments' will be the full count of ALL items (travels + consignments)
    // This part might need adjustment depending on how you want to count "empty" travels
    // This counts "travels with consignments" + "travels without consignments"
    const totalItems = results.length;
    
    // This counts only items that are actual consignments
    const totalConsignments = results.filter(c => c.consignmentId !== "N/A").length;
    
    console.log("Total Items (Travels + Consignments):", totalItems);
    console.log("Total Actual Consignments:", totalConsignments);
    console.log("Total Delivered Earnings:", totalDeliveredEarnings); 

    res.status(200).json({
      success: true,
      count: totalConsignments, // Send the count of actual consignments
      totalAcceptedEarnings: totalDeliveredEarnings,
      data: results, // Send the full list of items (travels + consignments)
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



export const cancelConsignment = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { consignmentId } = req.params;

        if (!consignmentId||!mongoose.Types.ObjectId.isValid(consignmentId)) {
          console.log("Invalid Consignment ID format:", consignmentId);
            return res.status(400).json({ success: false, message: "Invalid Consignment ID format." });
        }

        const consignment = await ConsignmentModel.findById(consignmentId);

        if (!consignment) {
            return res.status(404).json({ success: false, message: "Consignment not found." });
        }

        if (["delivered", "cancelled","in-transit","expired"].includes(consignment.status)) {
          console.log("Consignment current status:", consignment.status);
            return res.status(400).json({ success: false, message: `Consignment is already ${consignment.status}.` });
        }

        consignment.status = "cancelled";
        await consignment.save();
        
        await TravelConsignments.updateMany(
            { consignmentId: consignment._id, status: "to_handover" },
            { $set: { status: "cancelled" } }
        );
        
        await CarryRequest.updateMany(
            { consignmentId: consignment._id, status:{$in: ["accepted","accepted_pending_payment","pending"] }},
            { $set: { status: "expired" } }
        );

        res.status(200).json({
            success: true,
            message: "Consignment cancelled successfully.",
            consignment: consignment 
        });

    } catch (error) {
        console.error("Error cancelling consignment:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error while cancelling consignment",
        });
    }
};

export const adminCancelTravel = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { travelId } = req.params;

        // 1. Validate ID
        if (!travelId || !mongoose.Types.ObjectId.isValid(travelId)) {
            return res.status(400).json({ success: false, message: "Invalid Travel ID format." });
        }

        // 2. Find and Update the Travel document
        const travel = await TravelModel.findById(travelId);

        if (!travel) {
            return res.status(404).json({ success: false, message: "Travel not found." });
        }

        if (["completed", "cancelled","ongoing","expired"].includes(travel.status)) {
            return res.status(400).json({ success: false, message: `Travel is already ${travel.status}.` });
        }

        travel.status = "cancelled";
        await travel.save();

        // 3. Find all linked TravelConsignments
        const linkedTCs = await TravelConsignments.find({ travelId: travelId });

        if (linkedTCs.length > 0) {
            const consignmentIds = linkedTCs.map(tc => tc.consignmentId);

            // 4. Update TravelConsignments to "cancelled"
            await TravelConsignments.updateMany(
                { travelId: travelId, status: { $nin: ["delivered", "cancelled","in_transit"] } },
                { $set: { status: "cancelled" } }
            );

            // 5. Update original Consignments from "assigned" back to "published"
            await ConsignmentModel.updateMany(
                { _id: { $in: consignmentIds }, status: { $in: ["delivered", "in-transit", "cancelled","expired"] } },
                { $set: { status: "published" } }
            );

            // 6. Update associated "accepted" CarryRequests to "expired"
            await CarryRequest.updateMany(
                { travelId: travelId, status:{$in: ["accepted","pending","accepted_pending_payment"] }},
                { $set: { status: "expired" } }
            );

            // 7. Cancel any pending Earnings for this traveler on this trip
            await Earning.updateMany(
                { travelId: travelId, userId: travel.travelerId, status: {$in:["pending","payout_pending"]} },
                { $set: { status: "failed" } }
            );
        }

        res.status(200).json({
            success: true,
            message: "Travel cancelled successfully. All associated consignments have been re-published.",
            data: travel
        });

    } catch (error) {
        console.error("Error cancelling travel:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error while cancelling travel",
        });
    }
};
