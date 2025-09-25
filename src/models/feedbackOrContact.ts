
import mongoose, {model, Schema ,type Types} from "mongoose";

interface FeedbackOrContact { 
    userId: Types.ObjectId;
    Subject: string;
    Message: string;
}


const feedbackOrContactSchema = new mongoose.Schema<FeedbackOrContact>({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    Subject: { type: String, required: true, enum: ["I want to give feedback", "I want to contact support"] },
    Message: { type: String, required: true },
}, { timestamps: true })

export const FeedbackOrContactModel = model<FeedbackOrContact>("FeedbackOrContact", feedbackOrContactSchema);
