import type { Response } from "express";
import { Types } from "mongoose";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import Notification from "../../models/notification.model";
import { User } from "../../models/user.model";
import {
  getNotificationsValidator,
  markReadValidator,
} from "../../validations/notification.validator";

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const { page, limit } = getNotificationsValidator.parse(req.query);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments({ userId }),
    ]);

    console.log("notifications: ", notifications);
    console.log("total notifications: ", total);

    res.json({
      success: true,
      data: { notifications, total, page: pageNum, limit: limitNum },
    });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({
      success: false,
      error: err.message || "Failed to fetch notifications",
    });
  }
};

// Mark a notification as read
export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const { id } = markReadValidator.parse(req.params);

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true },
      { new: true }
    );

    if (!notification)
      return res
        .status(404)
        .json({ success: false, error: "Notification not found" });

    res.json({ success: true, data: notification });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({
      success: false,
      error: err.message || "Failed to mark notification as read",
    });
  }
};

// Mark all notifications as read
export const markAllRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
    res.json({ success: true, data: { updatedCount: result.modifiedCount } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Failed to mark all notifications as read",
    });
  }
};

// Create notification (internal use)
export const createNotification = async ({
  userId,
  type,
  message,
  meta,
}: {
  userId: string;
  type: string;
  message: string;
  meta?: Record<string, any>;
}) => {
  if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid userId");

  return Notification.create({ userId, type, message, meta });
};

export const notificationHelper = async (
  type:
    | "bySender"
    | "byTraveller"
    | "paymentSuccess"
    | "paymentFailed"
    | "consignmentCollected"
    | "consignmentDelivered"
    | "carryRequestExpired"
    | "travelCancelled"
    | "handoverFailed",
  consignment: any,
  typeOfNotif: "travel" | "consignment" | "general",
  userId: string | Types.ObjectId
) => {
  const user = await User.findById(userId).select("firstName lastName");
  const name = user ? `${user.firstName} ${user.lastName}` : "Unknown user";

  switch (type) {
    case "bySender":
      return {
        title: "New Carry Request",
        message: `${name} has requested you to carry their consignment.`,
        typeOfNotif,
      };
    case "byTraveller":
      return {
        title: "New Carry Request",
        message: `${name} wants to carry your consignment to your requested location.`,
        typeOfNotif,
      };
    case "paymentSuccess":
      return {
        title: "Payment Successful",
        message: `Payment received for your consignment. ₹${consignment.amount} credited in your wallet.`,
        typeOfNotif,
      };
    case "paymentFailed":
      return {
        title: "Payment Failed",
        message: `Payment of ₹${consignment.amount} failed. Please try again.`,
        typeOfNotif,
      };
    case "consignmentCollected":
      return {
        title: "Consignment Collected",
        message: `Your consignment has been collected by ${name}.`,
        typeOfNotif,
      };
    case "consignmentDelivered":
      return {
        title: "Consignment Delivered",
        message: `${name} delivered your consignment successfully.`,
        typeOfNotif,
      };
    case "carryRequestExpired":
      return {
        title: "Carry Request Expired",
        message: `Your carry request for the consignment "${consignment.consignmentId}" has expired.`,
        typeOfNotif,
      };
    case "travelCancelled":
      return {
        title: "Travel Cancelled",
        message: `${name} has cancelled their travel. Your consignment "${consignment.consignmentId}" is affected.`,
        typeOfNotif,
      };
    case "handoverFailed":
      return {
        title: "Handover Failed",
        message: `Handover of your consignment "${consignment.consignmentId}" failed. Please contact the traveller.`,
        typeOfNotif,
      };
    default:
      return {
        title: "Notification",
        message: "You have a new update.",
        typeOfNotif,
      };
  }
};
