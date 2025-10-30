import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import type { Response } from "express";
import ConsignmentModel from "../../models/consignment.model";
import { TravelModel } from "../../models/travel.model";
import TravelConsignments from "../../models/travelconsignments.model"; 
import { User } from "../../models/user.model";
import { Address } from "../../models/address.model";
import { CarryRequest } from "../../models/carryRequest.model";
import  Payment  from "../../models/payment.model";
import { RatingModel } from "../../models/rating.model";
import { Payout } from "../../models/payout.model";
import Notification from "../../models/notification.model";
import { FeedbackOrContactModel } from "../../models/feedbackOrContact";
import Earning from "../../models/earning.model";
import PayoutAccountsModel from "../../models/payoutaccounts.model";

export const getUsersList = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { page: pageQuery, limit: limitQuery, search: searchQuery } = req.query;
        const usePagination = pageQuery || limitQuery;

        if (usePagination) {
            const page = parseInt(pageQuery as string) || 1;
            const limit = parseInt(limitQuery as string) || 5;
            const search = (searchQuery as string) || "";

            const query = search
                ? {
                      $or: [
                          { firstName: { $regex: search, $options: "i" } },
                          { lastName: { $regex: search, $options: "i" } },
                          { email: { $regex: search, $options: "i" } },
                          { phoneNumber: { $regex: search, $options: "i" } },
                      ],
                  }
                : {};

            const skip = (page - 1) * limit;
            
            const [totalCount, users] = await Promise.all([
                User.countDocuments(query),
                User.find(query)
                    .select("-password -__v")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean()
            ]);

            return res.status(200).json({
                data: users,
                totalCount: totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
            });

        } else {
            const [users, totalCount] = await Promise.all([
                User.find({}).select("-password -__v").sort({ createdAt: -1 }).lean(),
                User.countDocuments({})
            ]);
            
            return res.status(200).json({
                data: users,
                totalCount: totalCount
            });
        }

    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ message: "An error occurred while fetching users" });
    }
};

/**
 * Gets the full details, including travel history, for a single user.
 */
export const getUserDetails = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { userId } = req.params; 

        const user = await User.findById(userId).select("-password").lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const userTravels = await TravelModel.find({ travelerId: userId }).lean();
        
        const travelsWithConsignments = await Promise.all(
            userTravels.map(async (travel) => {
                const travelLinks = await TravelConsignments.find({ travelId: travel._id }).lean();
                const consignmentIds = travelLinks.map(link => link.consignmentId);
                 const consignments = await ConsignmentModel.find({ _id: { $in: consignmentIds } }).lean();
                return { ...travel, consignmentDetails: consignments };
            })
        );

        return res.status(200).json({
            user,
            travels: travelsWithConsignments,
        });

    } catch (error) {
        console.error("Error fetching user details:", error);
        return res.status(500).json({ message: "An error occurred while fetching details" });
    }
};

/**
 * Deletes a user and all their associated travels and consignments.
 */
export const deleteUser = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { userId } = req.params; 
        
        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const travelsToDelete = await TravelModel.find({ travelerId: userId }).select('_id');
        const travelIds = travelsToDelete.map(t => t._id);

        await Promise.all([
            TravelModel.deleteMany({ travelerId: userId }),
            ConsignmentModel.deleteMany({ senderId: userId }),
            TravelConsignments.deleteMany({ travelId: { $in: travelIds }}),
            CarryRequest.deleteMany({ travellerId: userId }),
            CarryRequest.deleteMany({ requestedBy: userId }),
            Address.deleteMany({ userId: userId }),
            Payment.deleteMany({ userId: userId }),
            RatingModel.deleteMany({ travellerId: userId }),
            RatingModel.deleteMany({ senderId: userId }),
            Payout.deleteMany({ userId: userId }),
            PayoutAccountsModel.deleteMany({ userId: userId }),
            Notification.deleteMany({ userId: userId }),
           // Notification.deleteMany({ relatedTra userId })
           FeedbackOrContactModel.deleteMany({ userId: userId }),
           Earning.deleteMany({ userId: userId }),
            

        ]);


        return res.status(200).json({ message: "User deleted successfully" });

    } catch (error) {
        console.error("Error deleting user:", error);
        return res.status(500).json({ message: "An error occurred while deleting the user" });
    }
};


