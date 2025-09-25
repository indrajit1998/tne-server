import type { AuthRequest } from "../../middlewares/authMiddleware";
import type { Response } from "express";
import { FeedbackOrContactModel } from "../../models/feedbackOrContact";

export const postFeedbackOrContact = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user;
        const { Subject, Message } = req.body;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        let response;
        switch (Subject) {
            case "I want to give feedback":
                response = await FeedbackOrContactModel.create({ userId, Subject, Message });
                break;
            case "I want to contact support":
                response = await FeedbackOrContactModel.create({ userId, Subject, Message });
                break;
            default:
                return res.status(400).json({ message: "Invalid Subject" });
        }
        return res.status(200).json({ message: "Feedback/Contact request submitted successfully", data: response });

    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error while processing feedback/contact request", error });   
    }
}