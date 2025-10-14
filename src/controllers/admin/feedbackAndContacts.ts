import type { Response } from "express";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { FeedbackOrContactModel } from "../../models/feedbackOrContact.ts";
import mongoose from "mongoose";

const fetchEntries = async (subject: string, res: Response) => {
    try {
        const entries = await FeedbackOrContactModel.aggregate([
            {
                $match: { Subject: subject }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $unwind: {
                    path: "$userDetails",
                    preserveNullAndEmptyArrays: true 
                }
            },
            {
                $project: {
                    _id: 1,
                    name: { 
                        $concat: [
                            { $ifNull: ["$userDetails.firstName", ""] },
                            " ",
                            { $ifNull: ["$userDetails.lastName", ""] }
                        ]
                    },
                    phone: { $ifNull: ["$userDetails.phoneNumber", "Not Available"] },
                    email: { $ifNull: ["$userDetails.email", "Not Available"] },
                    message: "$Message",
                    createdAt: 1,
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        res.status(200).json({ success: true, data: entries });
    } catch (error) {
        console.error(`Error fetching ${subject}:`, error);
        res.status(500).json({ success: false, message: `Internal server error while fetching ${subject}` });
    }
};

// Controller to get feedback entries
export const getFeedback = async (req: AdminAuthRequest, res: Response) => {
    await fetchEntries("I want to give feedback", res);
};

// Controller to get support contact entries
export const getSupportContacts = async (req: AdminAuthRequest, res: Response) => {
    await fetchEntries("I want to contact support", res);
};
