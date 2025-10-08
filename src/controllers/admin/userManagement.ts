import { CODES } from "../../constants/statusCodes";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import type { Response } from "express";
import ConsignmentModel from "../../models/consignment.model";
import { TravelModel } from "../../models/travel.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { User } from "../../models/user.model";


export const manageUsers = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) { 
            return res.status(404).json({ message: "User not found" });
        }
        const userTravels = await TravelModel.find({ travelerId: userId }).lean();
        const userConsignments = await ConsignmentModel.find({ senderId: userId }).lean();
        const userTravelConsignments =await TravelConsignments.find({  consignmentId: { $in: userConsignments.map(c => c._id) } }).lean();
        return res.status(200).json({
            user,
            travels: userTravels,
            consignments: userConsignments,
            travelConsignments: userTravelConsignments
        });

    } catch (error) {
        return res.status(500).json({ message: "An error occurred", error });
    }
}
 

export const deleteUser = async (req: AdminAuthRequest, res: Response) => { 
    try {
        const { userId } = req.body;
        await User.findByIdAndDelete(userId);
        return res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "An error occurred", error });   
    }
}