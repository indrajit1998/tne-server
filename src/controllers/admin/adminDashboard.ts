import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import ConsignmentModel from "../../models/consignment.model";
import Earning from "../../models/earning.model";
import { FeedbackOrContactModel } from "../../models/feedbackOrContact";
import Payment from "../../models/payment.model";
import { TravelModel } from "../../models/travel.model";
import { User } from "../../models/user.model";
import type { Response } from "express";

export const getDashboardStats = async (req: AdminAuthRequest, res: Response) => {
    try {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

        const [
            // Main Counters
            totalUsers,
            totalEarningsResult,
            totalTravel,
            totalConsignments,
            totalRequests,
            totalAcceptedRequests,
            totalCancelledRequests, 
            totalPendingRequests,
            totalDeliveredConsignments,
            totalFeedback,
            totalSupport,
            
            // Daily Stats
            dailyTravel,
            dailyConsignments,
            dailyRequests,
            dailyAccepted,
            dailyCancelled,
            dailyDelivered,

            // Monthly Stats
            monthlyTravel,
            monthlyConsignments,
            monthlyRequests,
            monthlyAccepted,
            monthlyCancelled,
            monthlyDelivered,

        ] = await Promise.all([
            // Main Counters
            User.countDocuments(),
            Earning.aggregate([
                { $match: { status: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            TravelModel.countDocuments(),
            ConsignmentModel.countDocuments(),
            CarryRequest.countDocuments(),
            CarryRequest.countDocuments({ status: "accepted" }),
            CarryRequest.countDocuments({ status: "rejected" }),
            CarryRequest.countDocuments({ status: "pending" }), 
            ConsignmentModel.countDocuments({ status: "delivered" }),
            FeedbackOrContactModel.countDocuments({ Subject: "I want to give feedback" }),
            FeedbackOrContactModel.countDocuments({ Subject: "I want to contact support" }), 

            TravelModel.countDocuments({ createdAt: { $gte: startOfToday } }),
            ConsignmentModel.countDocuments({ createdAt: { $gte: startOfToday } }),
            CarryRequest.countDocuments({ createdAt: { $gte: startOfToday } }),
            CarryRequest.countDocuments({ status: "accepted", createdAt: { $gte: startOfToday } }),
            CarryRequest.countDocuments({ status: "rejected", createdAt: { $gte: startOfToday } }),
            ConsignmentModel.countDocuments({ status: "delivered", createdAt: { $gte: startOfToday } }),

            TravelModel.countDocuments({ createdAt: { $gte: startOfLastMonth } }),
            ConsignmentModel.countDocuments({ createdAt: { $gte: startOfLastMonth } }),
            CarryRequest.countDocuments({ createdAt: { $gte: startOfLastMonth } }),
            CarryRequest.countDocuments({ status: "accepted", createdAt: { $gte: startOfLastMonth } }),
            CarryRequest.countDocuments({ status: "rejected", createdAt: { $gte: startOfLastMonth } }),
            ConsignmentModel.countDocuments({ status: "delivered", createdAt: { $gte: startOfLastMonth } }),
        ]);

        const totalEarnings = totalEarningsResult[0]?.total || 0;

        const stats = {
            totalUsers,
            totalEarnings,
            totalTravel,
            totalConsignments,
            totalRequests,
            totalAccepted: totalAcceptedRequests,
            totalCancelled: totalCancelledRequests,
            totalPending: totalPendingRequests,
            totalDelivered: totalDeliveredConsignments,
            totalFeedback,
            totalSupport,
            daily: {
                totalTravel: dailyTravel,
                totalConsignments: dailyConsignments,
                totalRequests: dailyRequests,
                accepted: dailyAccepted,
                cancelled: dailyCancelled,
                delivered: dailyDelivered,
            },
            monthly: {
                totalTravel: monthlyTravel,
                totalConsignments: monthlyConsignments,
                totalRequests: monthlyRequests,
                accepted: monthlyAccepted,
                cancelled: monthlyCancelled,
                delivered: monthlyDelivered,
            },
        };
        
        return res.status(200).json({ data: stats, message: "Dashboard stats fetched successfully" });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getEarningsStats = async (req: AdminAuthRequest, res: Response) => { 
    try {
        const earning = await Earning.aggregate([
            { $match: { status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
        return res.status(200).json({ earning: earning[0]?.total || 0 });
    } catch (error) {

        console.error("Error fetching earnings stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const travelStats = async (req: AdminAuthRequest, res: Response) => { 
    try {
        const travels = await TravelModel.find({}).lean();
        const monthlyTravels = travels.filter(t => { 
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const travelDate = new Date(t.expectedStartDate);
            return (today.getTime() - travelDate.getTime()) < oneMonth;
        });
        const dailyTravels = travels.filter(t => {
            const oneDay = 24 * 60 * 60 * 1000;
            const today = new Date();
            const travelDate = new Date(t.expectedStartDate);
            return (today.getTime() - travelDate.getTime()) < oneDay;
        });
        return res.status(200).json({ monthlyTravels, dailyTravels, totalTravels: travels.length });
    } catch (error) {
        console.error("Error fetching travel stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const requestStats = async (req: AdminAuthRequest, res: Response) => {
    try {
        const requests = await CarryRequest.find({}).lean();
        const acceptedRequests = requests.filter(r => r.status === "accepted");
        const pendingRequests = requests.filter(r => r.status === "pending");
        const rejectedRequests = requests.filter(r => r.status === "rejected");
        const dailyRequests = requests.filter(r => { 
            const oneDay = 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneDay;
        });
        const dailyacceptedRequests = acceptedRequests.filter(r => { 
            const oneDay = 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneDay;
        });
        const dailyRejectedRequests = rejectedRequests.filter(r => { 
            const oneDay = 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneDay;
        });
        const dailyPendingRequests = pendingRequests.filter(r => {
            const oneDay = 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneDay;
        });
        const monthlyRequests = requests.filter(r => {
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneMonth;
        }
        );
        const monthlyAcceptedRequests = acceptedRequests.filter(r => {
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneMonth;
        });
        const monthlyRejectedRequests = rejectedRequests.filter(r => {
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneMonth;
        }
        );
        const monthlyPendingRequests = pendingRequests.filter(r => {
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneMonth;
        });
        const weeklyRequests = requests.filter(r => {
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const requestDate = new Date(r.createdAt);
            return (today.getTime() - requestDate.getTime()) < oneWeek;
        });
       

        return res.status(200).json({ 
            totalRequests: requests.length,
            acceptedRequests: acceptedRequests.length,
            pendingRequests: pendingRequests.length,
            rejectedRequests: rejectedRequests.length,
         });
    } catch (error) {
        console.error("Error fetching request stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const consignmentStats = async (req: AdminAuthRequest, res: Response) => {
    try {
        const consignment = await ConsignmentModel.find({}).lean();
        const deliveredConsignments = consignment.filter(c => c.status === "delivered");
        const dailyConsignments = consignment.filter(c => { 
            const oneDay = 24 * 60 * 60 * 1000;
            const today = new Date();
            const consignmentDate = new Date(c.createdAt ?? 0);
            return (today.getTime() - consignmentDate.getTime()) < oneDay;
        });
        const monthlyConsignments = consignment.filter(c => {
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const consignmentDate = new Date(c.createdAt ?? 0);
            return (today.getTime() - consignmentDate.getTime()) < oneMonth;
        });
        const dailyDeliveredConsignments = deliveredConsignments.filter(c => { 
            const oneDay = 24 * 60 * 60 * 1000;
            const today = new Date();
            const consignmentDate = new Date(c.createdAt ?? 0);
            return (today.getTime() - consignmentDate.getTime()) < oneDay;
        });
        const monthlyDeliveredConsignments = deliveredConsignments.filter(c => {
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const today = new Date();
            const consignmentDate = new Date(c.createdAt ?? 0);
            return (today.getTime() - consignmentDate.getTime()) < oneMonth;
        });
        return res.status(200).json({ 
            totalConsignments: consignment.length,
            deliveredConsignments: deliveredConsignments.length,
            dailyConsignments: dailyConsignments.length,
            monthlyConsignments: monthlyConsignments.length,
            dailyDeliveredConsignments: dailyDeliveredConsignments.length,
            monthlyDeliveredConsignments: monthlyDeliveredConsignments.length
        });
    } catch (error) {
        
    }
}

export const getFeedbackOrContact = async (req: AdminAuthRequest, res: Response) => { 
    try {
        const results = await FeedbackOrContactModel.find({}).populate("userId", "firstName email").lean();
        const feedbacks = results.filter(r => r.Subject === "I want to give feedback");
        
        const contacts = results.filter(r => r.Subject === "I want to contact support");
        return res.status(200).json({ totalRequests: results.length, feedbacks: feedbacks.length, contacts: contacts.length, results });
    } catch (error) {
        
    }
}

export const getTransactionHistory = async (req: AdminAuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [transactions, totalTransactions] = await Promise.all([
            Payment.find({})
                .populate("userId" , "firstName lastName email phoneNumber") // Populate with more user details
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payment.countDocuments({})
        ]);

        return res.status(200).json({
            total: totalTransactions,
            currentPage: page,
            totalPages: Math.ceil(totalTransactions / limit),
            data: transactions,
        });
    } catch (error) {
        console.error("Error fetching transaction history:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};