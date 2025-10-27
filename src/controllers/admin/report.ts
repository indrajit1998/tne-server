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



// export const getConsolidateConsignment = async (req: AdminAuthRequest, res: Response) => {
//  try {
//    const page = parseInt(req.query.page as string) || 1;
//    const limit = parseInt(req.query.limit as string) || 30;
//    const skip = (page - 1) * limit;
//    const search = (req.query.search as string) || "";

//    const config = await FareConfigModel.findOne().lean();
//    const gstRate = config?.gst || 0;
//    const marginRate = config?.margin || 0;
//    const teFee = config?.TE || 0;
//    console.log("GST Rate:", gstRate, "Margin Rate:", marginRate, "TE Fee:", teFee);
//    const searchQuery = search ? {
//      $or: [
//        { 'senderInfo.firstName': { $regex: search, $options: 'i' } },
//        { 'senderInfo.lastName': { $regex: search, $options: 'i' } },
//        { 'senderInfo.email': { $regex: search, $options: 'i' } },
//        { 'senderInfo.phoneNumber': { $regex: search, $options: 'i' } },
//        { 'travellerInfo.firstName': { $regex: search, $options: 'i' } },
//        { 'travellerInfo.lastName': { $regex: search, $options: 'i' } },
//        { 'travellerInfo.email': { $regex: search, $options: 'i' } },
//        { 'travellerInfo.phoneNumber': { $regex: search, $options: 'i' } },
//        { 'consignmentInfo.description': { $regex: search, $options: 'i' } },
//        { 'consignmentInfo.status': { $regex: search, $options: 'i' } },
//        { 'status': { $regex: search, $options: 'i' } }, 
//        { 'consignmentInfo.fromAddress.city': { $regex: search, $options: 'i' } },
//        { 'consignmentInfo.toAddress.city': { $regex: search, $options: 'i' } },
//      ]
//    } : {};

//    const basePipeline: PipelineStage[] = [
//      // ... (Your $lookup and $unwind stages remain the same)
//      { $lookup: { from: "consignments", localField: "consignmentId", foreignField: "_id", as: "consignmentInfo" } },
//      { $unwind: "$consignmentInfo" },
//      { $lookup: { from: "users", localField: "consignmentInfo.senderId", foreignField: "_id", as: "senderInfo" } },
//      { $unwind: "$senderInfo" },
//      { $lookup: { from: "travels", localField: "travelId", foreignField: "_id", as: "travelInfo" } },
//      { $unwind: "$travelInfo" },
//      { $lookup: { from: "users", localField: "travelInfo.travelerId", foreignField: "_id", as: "travellerInfo" } },
//      { $unwind: "$travellerInfo" },
//      { $match: searchQuery },
     
//      // --- *** UPDATED $project STAGE *** ---
//      {
//        $project: {
//          _id: 0,
//          consignmentId: { $toString: "$consignmentInfo._id" }, 
//          senderName: { $concat: ["$senderInfo.firstName", " ", "$senderInfo.lastName"] },
//          senderPhone: "$senderInfo.phoneNumber",
//          senderEmail: "$senderInfo.email",
//          travellerName: { $concat: ["$travellerInfo.firstName", " ", "$travellerInfo.lastName"] },
//          travellerPhone: "$travellerInfo.phoneNumber",
//          travellerEmail: "$travellerInfo.email",
//          fromCity: "$consignmentInfo.fromAddress.city",
//          toCity: "$consignmentInfo.toAddress.city",
//          sendingDate: "$consignmentInfo.sendingDate",
//          consignmentStatus: "$consignmentInfo.status",
//          travelConsignmentStatus: "$status", 
//          senderPaid: "$senderToPay",
//          travellerEarned: "$travellerEarning",
//          pickupTime: "$pickupTime",
//          deliveryTime: "$deliveryTime",
//          createdAt: "$createdAt",
//          modeOfTravel: "$travelInfo.modeOfTravel",
//         travelAndEarnFee: { $literal: teFee },
//     gstAmount: { $multiply: ["$senderToPay", { $divide: [gstRate, 100] }] },
//     baseForMargin: {
//       $subtract: [
//         "$senderToPay",
//         { $multiply: ["$senderToPay", { $divide: [gstRate, 100] }] }
//       ]
//     },

//     marginAmount: {
//       $multiply: [
//         {
//           $subtract: [
//             "$senderToPay",
//             { $multiply: ["$senderToPay", { $divide: [gstRate, 100] }] }
//           ]
//         },
//         { $divide: [marginRate, 100] }
//       ]
//     },

//     remainingAmount: {
//       $subtract: [
//         {
//           $subtract: [
//             {
//               $subtract: [
//                 {
//                   $subtract: [
//                     "$senderToPay",
//                     { $multiply: ["$senderToPay", { $divide: [gstRate, 100] }] }
//                   ]
//                 },
//                 { $multiply: [
//                     {
//                       $subtract: [
//                         "$senderToPay",
//                         { $multiply: ["$senderToPay", { $divide: [gstRate, 100] }] }
//                       ]
//                     },
//                     { $divide: [marginRate, 100] }
//                   ] }
//               ]
//             },
//             { $literal: teFee } 
//           ]
//         },
//         "$travellerEarning"
//       ]
//     }
//        },
//      },
//      // --- *** END OF UPDATED $project STAGE *** ---

//      { $sort: { createdAt: -1 } }, // Sort by creation date of the link
//    ];

//    // Pipeline to get total count matching search
//    const countPipeline: PipelineStage[] = [...basePipeline, { $count: "total" }];

//    // Pipeline to get paginated results
//    const dataPipeline: PipelineStage[] = [...basePipeline, { $skip: skip }, { $limit: limit }];

//    // Execute count and data pipelines
//    const [totalResult, stats] = await Promise.all([
//       TravelConsignments.aggregate(countPipeline),
//       TravelConsignments.aggregate(dataPipeline)
//    ]);

//    const totalConsignments = totalResult[0]?.total || 0;
//    const totalPages = Math.ceil(totalConsignments / limit);
//    console.log("Total Consignments:", totalConsignments);
//    return res.status(200).json({
//      success: true,
//      total: totalConsignments,
//      currentPage: page,
//      totalPages: totalPages,
//      data: stats,
//    });
//  } catch (error) {
//    console.error("Error fetching consolidated consignment:", error);
//    return res.status(500).json({
//      success: false,
//      message: "Internal Server Error while fetching consolidated consignment",
//    });
//  }
// };






// export const getConsolidateConsignment = async (req: AdminAuthRequest, res: Response) => {
//   try {
//     const stats = await CarryRequest.find({})
//       .populate({
//         path: "consignmentId",
//         select: "senderId status createdAt",
//         populate: {
//           path: "senderId",
//           select: "firstName lastName phoneNumber email",
//         },
//       })
//       .populate({
//         path: "travellerId",
//         select: "firstName lastName email phoneNumber",
//       })
//       .sort({ createdAt: -1 })
//       .lean();

//     return res.status(200).json({
//       success: true,
//       total: stats.length,
//       data: stats,
//     });
//   } catch (error) {
//     console.error("Error fetching consolidated consignment:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error while fetching consolidated consignment",
//     });
//   }
// };






// export const getTravellerReport = async (req: AdminAuthRequest, res: Response) => {
//     try {
//         const page = parseInt(req.query.page as string) || 1;
//         const limit = parseInt(req.query.limit as string) || 10;
//         const skip = (page - 1) * limit;
//         const search = (req.query.search as string) || "";

//         // Base pipeline starts from CarryRequest to accurately sum accepted earnings/counts
//         const basePipeline = [
//             // Stage 1: Filter for only accepted Carry Requests
//             {
//                 $match: { status: "accepted" }
//             },
//             // Stage 2: Group by travellerId to calculate totals per traveler
//             {
//                 $group: {
//                     _id: "$travellerId", // Group by the traveler who accepted the request
//                     totalEarnings: { $sum: "$travellerEarning" }, // Sum earnings from accepted requests
//                     consignmentCount: { $sum: 1 }, // Count the number of accepted requests
//                 },
//             },
//             // Stage 3: Lookup user details for the traveler
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "_id", // Link using the grouped travelerId (_id)
//                     foreignField: "_id",
//                     as: "travelerInfo",
//                 },
//             },
//             // Stage 4: Unwind travelerInfo.
//             // This stage now acts as an "inner join" and will DISCARD
//             // any records where a user was not found (i.e., the orphan record).
//             {
//                  $unwind: "$travelerInfo"
//             },
//             // Stage 5: Apply search filter AFTER getting user info
//             {
//                  $match: search ? {
//                     $or: [
//                         // Search on the looked-up user fields or the calculated fields
//                         { 'travelerInfo.firstName': { $regex: search, $options: 'i' } },
//                         { 'travelerInfo.lastName': { $regex: search, $options: 'i' } },
//                         { 'travelerInfo.email': { $regex: search, $options: 'i' } },
//                         { 'travelerInfo.phoneNumber': { $regex: search, $options: 'i' } },
//                     ]
//                 } : {}
//             },
//              // Stage 6: Final Project for output structure
//              {
//                 $project: {
//                     _id: 0,
//                     travelerId: { $toString: "$_id" }, 
                    
//                     name: { $concat: ["$travelerInfo.firstName", " ", "$travelerInfo.lastName"] },
//                     email: "$travelerInfo.email",
//                     phone: "$travelerInfo.phoneNumber",
//                     consignmentCount: 1, // Keep the calculated count
//                     totalEarnings: 1 // Keep the calculated earnings
//                 }
//              },
//              // Stage 7: Sort
//              { $sort: { totalEarnings: -1, name: 1 } }, // Sort by earnings, then name
//         ];

//         // --- Execute Aggregations for Count and Data ---
//          // Pipeline to get total count matching search (based on the grouped results)
//         // THIS IS THE FIX: We use the same basePipeline to get the count
//         const countPipeline = [...basePipeline, { $count: "total" }];

//         // Pipeline to get paginated results
//         const dataPipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];

//         // Execute both pipelines concurrently
//         const [totalResult, stats] = await Promise.all([
//              CarryRequest.aggregate(countPipeline), // Base collection is CarryRequest
//              CarryRequest.aggregate(dataPipeline)   // Base collection is CarryRequest
//         ]);

//         // The total count is now taken from the result of the countPipeline
//         const totalTravellers = totalResult[0]?.total || 0;
//         const totalPages = Math.ceil(totalTravellers / limit);


//         res.status(200).json({
//             success: true,
//             currentPage: page,
//             totalPages,
//             totalTravellers, // This count will now be 1 (or only show valid, found users)
//             stats, // The paginated results
//         });
//     } catch (err) {
//         console.error("Error fetching traveller stats:", err);
//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error while fetching traveller stats",
//         });
//     }
// };


// export const getSenderReport = async (req: AdminAuthRequest, res: Response) => {
//   try {
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 10;
//     const skip = (page - 1) * limit;

//     const stats = await ConsignmentModel.aggregate([
      
//       //{ $match: { status: "delivered" } },

//       {
//         $lookup: {
//           from: "carryrequests",
//           localField: "_id",
//           foreignField: "consignmentId",
//           as: "carryRequests",
//         },
//       },

//       { $unwind: { path: "$carryRequests", preserveNullAndEmptyArrays: true } },
//       {
//         $group: {
//           _id: "$senderId",
//           consignmentCount: { $sum: 1 },
//           totalPaid: { $sum: { $ifNull: ["$carryRequests.senderPayAmount", 0] } },
//         },
//       },

//       {
//         $lookup: {
//           from: "users",
//           localField: "_id",
//           foreignField: "_id",
//           as: "sender",
//         },
//       },

//       { $unwind: "$sender" },

//       {
//         $project: {
//           _id: 0,
//           senderId: "$_id",
//           name: "$sender.firstName",
//           email: "$sender.email",
//           phone: "$sender.phoneNumber",
//           consignmentCount: 1,
//           totalPaid: 1,
//         },
//       },

//       { $sort: { totalPaid: -1 } },
//       { $skip: skip },
//       { $limit: limit },
//     ]);

//     const totalSenders = await ConsignmentModel.distinct("senderId");
//     const totalPages = Math.ceil(totalSenders.length / limit);

//     res.status(200).json({
//       success: true,
//       currentPage: page,
//       totalPages,
//       totalSenders: totalSenders.length,
//       stats,
//     });
//   } catch (error) {
//     console.error("Error fetching sender report:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error while fetching sender report",
//     });
//   }
// };

// Add these imports at the top of your report.ts file; 




export const getConsolidateConsignment = async (req: AdminAuthRequest, res: Response) => {
 try {

   // --- Fetch Fare Configuration First ---
   const config = await FareConfigModel.findOne().lean();
   const gstRate = config?.gst || 0;
   const marginRate = config?.margin || 0;
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
       $project: {
         _id: 0,
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
         gstAmount: { 
             $multiply: [ "$senderToPay", { $divide: [gstRate, 100] } ] 
         },
         
         baseForMargin: {
             $subtract: [ "$senderToPay", { $multiply: [ "$senderToPay", { $divide: [gstRate, 100] } ] } ]
         },

         marginAmount: {
             $multiply: [
                 { $subtract: [ "$senderToPay", { $multiply: [ "$senderToPay", { $divide: [gstRate, 100] } ] } ] },
                 { $divide: [marginRate, 100] }
             ]
         },
         
         travelAndEarnFee: { $literal: teFee },
         
         remainingAmount: {
             $subtract: [
                 { 
                     $subtract: [
                         { $subtract: [ 
                             // baseForMargin
                             { $subtract: [ "$senderToPay", { $multiply: [ "$senderToPay", { $divide: [gstRate, 100] } ] } ] },
                             // marginAmount
                             { $multiply: [
                                 { $subtract: [ "$senderToPay", { $multiply: [ "$senderToPay", { $divide: [gstRate, 100] } ] } ] },
                                 { $divide: [marginRate, 100] }
                               ] 
                             }
                         ] },
                         // - teFee
                          { $literal: teFee}
                     ]
                 },
                 // - travellerEarning
                 "$travellerEarning"
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
          platformCommission: { $sum: { $cond: [{ $eq: ["$type", "platform_commission"] }, "$amount", 0] } }, 
          senderPayCount: { $sum: { $cond: [{ $eq: ["$type", "sender_pay"] }, 1, 0] } },
          travellerEarningCount: { $sum: { $cond: [{ $eq: ["$type", "traveller_earning"] }, 1, 0] } },
          platformCommissionCount: { $sum: { $cond: [{ $eq: ["$type", "platform_commission"] }, 1, 0] } }, 
          allPayments: { $push: "$$ROOT" }
        }
      },

      
      {
        $project: {
          _id: 0,
          summary: {
            totalRevenue: "$totalRevenue",
            totalPayouts: "$totalPayouts",
            platformCommission: "$platformCommission",
            netRevenue: { $subtract: ["$totalRevenue", "$totalPayouts"] },
            totalTransactions: { $size: "$allPayments" },
            senderPayCount: "$senderPayCount",
            travellerEarningCount: "$travellerEarningCount",
            platformCommissionCount: "$platformCommissionCount", 
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
            platform_commission: { 
              $filter: {
                input: "$allPayments", as: "payment", cond: { $eq: ["$$payment.type", "platform_commission"] }
              }
            }
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
          "regionBreakdown.platform_commission": { 
            $map: {
              input: "$regionBreakdown.platform_commission",
              as: "p",
              in: { 
                region: { $concat: ["$$p.travelInfo.fromAddress.city", ", ", "$$p.travelInfo.fromAddress.state"] }, 
                totalAmount: "$$p.amount",
                modeOfTravel: "$$p.travelInfo.modeOfTravel"
              }
            }
          }
        }
      }
    ];

    const results = await Payment.aggregate(pipeline);

    const data = results[0] || {
      summary: {
        totalRevenue: 0, totalPayouts: 0,  platformCommission: 0, netRevenue: 0, 
        totalTransactions: 0, senderPayCount: 0, travellerEarningCount: 0,  platformCommissionCount: 0,
      },
      regionBreakdown: { sender_pay: [], traveller_earning: [], platform_commission: [] } 
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


export const getTravellerReport = async (req: AdminAuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const search = (req.query.search as string) || "";

        // Base pipeline now starts from TravelConsignments
        const basePipeline :PipelineStage[] =[
            // Stage 1: Lookup Travel to get travelerId
            {
                $lookup: {
                    from: "travels",
                    localField: "travelId",
                    foreignField: "_id",
                    as: "travelDetails",
                },
            },
            {
                $unwind: "$travelDetails" // Unwind to filter by traveler
            },
            // Stage 2: Group by travelerId to get all stats
            {
                $group: {
                    _id: "$travelDetails.travelerId", // Group by the traveler
                    
                    // --- *** LOGIC FIX AS REQUESTED *** ---
                    // 1. Sum earnings ONLY if status is "delivered"
                    // We check the status on the TravelConsignments document
                    totalEarnings: {
                        $sum: {
                            $cond: [ { $eq: ["$status", "delivered"] }, "$travellerEarning", 0 ]
                        }
                    },
                    // 2. Count ALL consignments
                    consignmentCount: { $sum: 1 },
                },
            },
            // Stage 3: Lookup user details for the traveler
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "travelerInfo",
                },
            },
            // Stage 4: Unwind travelerInfo (acts as inner join, filters out deleted users)
            {
                 $unwind: "$travelerInfo"
            },
            // Stage 5: Apply search filter
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
             // Stage 6: Final Project
             {
                $project: {
                    _id: 0,
                    travellerId: { $toString: "$_id" },
                    name: { $concat: ["$travelerInfo.firstName", " ", "$travelerInfo.lastName"] },
                    email: "$travelerInfo.email",
                    phone: "$travelerInfo.phoneNumber",
                    consignmentCount: 1, // This will be the total count (e.g., 16)
                    totalEarnings: 1      // This will be the conditional sum (e.g., 13,350.00)
                }
             },
             // Stage 7: Sort
             { $sort: { totalEarnings: -1, name: 1 } },
        ];

        // --- Execute Aggregations for Count and Data ---
        const countPipeline = [...basePipeline, { $count: "total" }];
        const dataPipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];

        const [totalResult, stats] = await Promise.all([
             TravelConsignments.aggregate(countPipeline), // Base collection is now TravelConsignments
             TravelConsignments.aggregate(dataPipeline)   // Base collection is now TravelConsignments
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

    // Use aggregate pipeline for efficiency
    const consignments = await TravelConsignments.aggregate([
      // Stage 1: Lookup Travel details
      {
        $lookup: {
          from: "travels",
          localField: "travelId",
          foreignField: "_id",
          as: "travelDetails",
        },
      },
      {
        $unwind: "$travelDetails",
      },
      // Stage 2: Match travels for the specified traveler
      {
        $match: {
          "travelDetails.travelerId": travelerId,
        },
      },
      // Stage 3: Lookup Consignment details
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
      // Stage 4: Lookup Payment details
      {
        $lookup: {
          from: "payments",
          let: { consignment_id: "$consignmentId", travel_id: "$travelId" },
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
      // Stage 5: Project the desired fields
      {
        $project: {
          _id: 0,
          consignmentId: { $toString: "$consignmentDetails._id" },
          startingLocation: "$consignmentDetails.fromAddress.city",
          endingLocation: "$consignmentDetails.toAddress.city",
          paymentStatus: { $ifNull: ["$paymentDetails.status", "Pending"] },
          consignmentStatus: "$consignmentDetails.status",
          dateOfSending: "$consignmentDetails.sendingDate",
          weight: { $concat: [{ $toString: "$consignmentDetails.weight" }, " ", "$consignmentDetails.weightUnit"] },
          receiverName: "$consignmentDetails.receiverName",
          receiverPhone: "$consignmentDetails.receiverPhone",
          earnings: "$travellerEarning",
          carryStatus: "$status", // Status from TravelConsignments
          modeOfTravel: "$travelDetails.modeOfTravel"
        },
      },
      { $sort: { dateOfSending: -1 } }
    ]);
    
    // --- *** LOGIC FIX AS REQUESTED *** ---
    // Calculate the total earnings for "delivered" consignments ONLY.
    // The modal's 'Total Earnings' will now be based on this value.
    const totalDeliveredEarnings = consignments.reduce((sum, c) => {
        // Use carryStatus, which is the status from TravelConsignments
        if (c.carryStatus === 'delivered') {
            return sum + (c.earnings || 0);
        }
        return sum;
    }, 0);

    // The modal's 'Total Consignments' will be the full count.
    const totalConsignments = consignments.length;
    console.log("Total Consignments:", totalConsignments);
    console.log("Total Delivered Earnings:", totalDeliveredEarnings); 
    //console.log("Consignments Data:", consignments);
    res.status(200).json({
      success: true,
      count: totalConsignments, // This will be 16
      totalAcceptedEarnings: totalDeliveredEarnings, // This will be 13,350.00
      data: consignments, // This will be the list of 16 consignments
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
            return res.status(400).json({ success: false, message: "Invalid Consignment ID format." });
        }

        const consignment = await ConsignmentModel.findById(consignmentId);

        if (!consignment) {
            return res.status(404).json({ success: false, message: "Consignment not found." });
        }

        if (["delivered", "cancelled","in-transit"].includes(consignment.status)) {
            return res.status(400).json({ success: false, message: `Consignment is already ${consignment.status}.` });
        }

        consignment.status = "cancelled";
        await consignment.save();

        await TravelConsignments.updateMany(
            { consignmentId: consignment._id },
            { $set: { status: "cancelled" } }
        );
        
        await CarryRequest.updateMany(
            { consignmentId: consignment._id, status: "accepted" },
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
