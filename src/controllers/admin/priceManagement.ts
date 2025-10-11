import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import FareConfigModel from "../../models/fareconfig.model";
import type { Response } from "express";

export const getPrices = async (req: AdminAuthRequest, res: Response) => {
    try {
        const fareConfig = await FareConfigModel.findOne().lean();
        if (!fareConfig) {
            return res.status(404).json({ message: "Fare config not found" });
        }
        return res.status(200).json({ fareConfig });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error while fetching fare config", error });
    }
};

//old one requires fareConfigId in body but there is only one document so no need to send id
export const managePrices = async (req: AdminAuthRequest, res: Response) => {
    try {
        // Get the values from the request body
        const updatedValues = req.body;
        const fareConfig = await FareConfigModel.findOneAndUpdate({}, updatedValues, { new: true, upsert: true });

        return res.status(200).json({ message: "Fare config updated successfully", fareConfig });
        
    } catch (error) {
        return res.status(500).json({ message: "Internal server error while updating fare config", error });
    }
}