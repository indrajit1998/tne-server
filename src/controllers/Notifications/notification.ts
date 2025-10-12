import type { Response } from "express";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import Notification from "../../models/notification.model";
import {
  getNotificationsValidator,
  markReadValidator,
} from "../../validations/notification.validator";
import { Types } from "mongoose";

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
