import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import ConsignmentModel from "../../models/consignment.model";
import Earning from "../../models/earning.model";
import { TravelModel } from "../../models/travel.model";
import { User } from "../../models/user.model";
import type { Response } from "express";


export const getUsersStats = async (req: AdminAuthRequest, res: Response) => {
    try {
        
        const user = await User.find({}).select("-password -__v").lean();
        return res.status(200).json({ user });
    } catch (error) {
        console.error("Error fetching user stats:", error);
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

