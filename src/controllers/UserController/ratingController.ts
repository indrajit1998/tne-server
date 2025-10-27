import type { Response } from "express";
import mongoose from "mongoose";
import { SENDER_RATING_WINDOW_DAYS } from "../../constants/constant";
import logger from "../../lib/logger";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import { RatingModel } from "../../models/rating.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { User } from "../../models/user.model";

export const createRating = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const senderId = userId;
    const { travelConsignmentId, rating, improvementCategory, feedback } =
      req.body;

    // 1. Validate input
    if (!travelConsignmentId || !rating) {
      await session.abortTransaction();
      return res.status(400).json({
        message:
          "Missing required fields: travelConsignmentId and rating are required.",
      });
    }

    // 2. Validate rating value
    if (rating < 1 || rating > 5) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Rating must be between 1 and 5",
      });
    }

    // 3. Check if TravelConsignment exists and is delivered
    const travelConsignment = await TravelConsignments.findById(
      travelConsignmentId
    )
      .populate("consignmentId")
      .session(session);

    if (!travelConsignment) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Travel consignment not found",
      });
    }

    if (travelConsignment.status !== "delivered") {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Can only rate after successful delivery",
      });
    }

    // 4. Verify sender owns this consignment
    const consignment = await mongoose
      .model("Consignment")
      .findById(travelConsignment.consignmentId)
      .session(session);

    if (!consignment || consignment.senderId.toString() !== senderId) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "Unauthorized: You can only rate your own deliveries",
      });
    }

    // 5. Check for duplicate rating
    const existingRating = await RatingModel.findOne({
      travelConsignmentId,
      senderId,
    }).session(session);

    if (existingRating) {
      await session.abortTransaction();
      return res.status(409).json({
        message: "You have already rated this delivery",
      });
    }

    // 6. Check if rating is within 7 days of delivery
    const deliveryTime = travelConsignment.deliveryTime;
    if (deliveryTime) {
      const daysSinceDelivery =
        (Date.now() - new Date(deliveryTime).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > SENDER_RATING_WINDOW_DAYS) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Rating period expired. You can only rate within ${SENDER_RATING_WINDOW_DAYS} days of delivery.`,
        });
      }
    }

    // 7. Get traveller ID from travel
    const travel = await mongoose
      .model("Travel")
      .findById(travelConsignment.travelId)
      .session(session);

    if (!travel) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Travel not found",
      });
    }

    const travellerId = travel.travelerId;

    // 8. Create rating
    const newRating = await RatingModel.create(
      [
        {
          travelConsignmentId,
          senderId,
          travellerId,
          consignmentId: travelConsignment.consignmentId,
          rating,
          improvementCategory: improvementCategory || null,
          feedback: feedback?.trim() || "",
          isAnonymous: true,
        },
      ],
      { session }
    );

    // 9. Update traveller's profile stats
    const travellerRatings = await RatingModel.find({ travellerId }).session(
      session
    );

    const totalRatings = travellerRatings.length;
    const sumRatings = travellerRatings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

    await User.findByIdAndUpdate(
      travellerId,
      {
        rating: parseFloat(averageRating.toFixed(2)),
        reviewCount: totalRatings,
      },
      { session }
    );

    await session.commitTransaction();

    logger.info(`Rating created successfully for traveller ${travellerId}`);

    return res.status(201).json({
      message: "Rating submitted successfully",
      rating: newRating[0],
    });
  } catch (error: any) {
    await session.abortTransaction();
    logger.error("Error creating rating:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "You have already rated this delivery",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const checkIfRated = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const senderId = userId;
    const { travelConsignmentId } = req.params;

    const existingRating = await RatingModel.findOne({
      travelConsignmentId,
      senderId,
    });

    return res.status(200).json({
      hasRated: !!existingRating,
      rating: existingRating || null,
    });
  } catch (error: any) {
    logger.error("Error checking rating status:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getTravellerRatings = async (req: AuthRequest, res: Response) => {
  try {
    const { travellerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const ratings = await RatingModel.find({ travellerId })
      .populate({
        path: "senderId",
        select: "firstName profilePictureUrl",
      })
      .populate({
        path: "consignmentId",
        select: "fromAddress toAddress",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalRatings = await RatingModel.countDocuments({ travellerId });

    return res.status(200).json({
      message: "Ratings fetched successfully",
      ratings,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalRatings / limitNum),
        totalRatings,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching traveller ratings:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const canRateConsignment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const senderId = userId;
    const { travelConsignmentId } = req.params;

    // Check if already rated
    const existingRating = await RatingModel.findOne({
      travelConsignmentId,
      senderId,
    });

    if (existingRating) {
      return res.status(200).json({
        canRate: false,
        reason: "Already rated",
      });
    }

    // Check consignment status and delivery time
    const travelConsignment = await TravelConsignments.findById(
      travelConsignmentId
    ).populate("consignmentId");

    if (!travelConsignment) {
      return res.status(404).json({
        canRate: false,
        reason: "Consignment not found",
      });
    }

    if (travelConsignment.status !== "delivered") {
      return res.status(200).json({
        canRate: false,
        reason: "Not yet delivered",
      });
    }

    // Check 7-day limit
    const deliveryTime = travelConsignment.deliveryTime;
    if (deliveryTime) {
      const daysSinceDelivery =
        (Date.now() - new Date(deliveryTime).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDelivery > SENDER_RATING_WINDOW_DAYS) {
        return res.status(200).json({
          canRate: false,
          reason: `Rating period expired (${SENDER_RATING_WINDOW_DAYS} days)`,
        });
      }
    }

    return res.status(200).json({
      canRate: true,
      deliveryTime: deliveryTime,
    });
  } catch (error: any) {
    logger.error("Error checking if can rate:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
