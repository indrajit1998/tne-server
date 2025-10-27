import { model, Schema, type Types } from "mongoose";

interface Rating {
  travelConsignmentId: Types.ObjectId;
  senderId: Types.ObjectId;
  travellerId: Types.ObjectId;
  consignmentId: Types.ObjectId;
  rating: number; // 1 to 5 (with 0.5 increments)
  improvementCategory: string;
  feedback: string;
  isAnonymous: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ratingSchema = new Schema<Rating>(
  {
    travelConsignmentId: {
      type: Schema.Types.ObjectId,
      ref: "TravelConsignments",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    travellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    consignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Consignment",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    improvementCategory: {
      type: String,
      //   required: true,
      enum: [
        "communication",
        "delivery_time",
        "package_handling",
        "professionalism",
        "other",
      ],
      default: null,
    },
    feedback: {
      type: String,
      //   required: true,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate ratings
ratingSchema.index({ travelConsignmentId: 1, senderId: 1 }, { unique: true });

// Index for traveller profile queries
ratingSchema.index({ travellerId: 1, createdAt: -1 });

export const RatingModel = model<Rating>("Rating", ratingSchema);
