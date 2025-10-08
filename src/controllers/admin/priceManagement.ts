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

export const managePrices = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { TE, deliveryFee, margin, weightRateTrain, distanceRateTrain, baseFareTrain, weightRateFlight, distanceRateFlight, baseFareFlight, fareConfigId } = req.body;
        const fareConfig = await FareConfigModel.findByIdAndUpdate(fareConfigId, {
            TE,
            deliveryFee,
            margin,
            weightRateTrain,
            distanceRateTrain,
            baseFareTrain,
            weightRateFlight,
            distanceRateFlight,
            baseFareFlight
        }, { new: true });
        if (!fareConfig) {
            return res.status(404).json({ message: "Fare config not found" });
        }
        return res.status(200).json({ message: "Fare config updated successfully", fareConfig });
        
    } catch (error) {
        return res.status(500).json({ message: "Internal server error while updating fare config", error });
    }
}