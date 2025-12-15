import type { Response } from 'express';
import { Types } from 'mongoose';
import type { AuthRequest } from '../../middlewares/authMiddleware';
import Notification from '../../models/notification.model';
import { User } from '../../models/user.model';
import {
  getNotificationsValidator,
  markReadValidator,
} from '../../validations/notification.validator';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    }

    const { page, limit } = getNotificationsValidator.parse(req.query);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .populate({
          path: 'requestId',
          select: 'status',
          model: 'CarryRequest',
        })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments({ userId }),
    ]);

    // console.log("notifications: ", notifications);
    // console.log("total notifications: ", total);

    // Transform notifications to include status
    const transformedNotifications = notifications.map(notif => {
      const carryRequest = notif.requestId as any;
      return {
        ...notif,
        status: carryRequest?.status || null,
      };
    });

    res.json({
      success: true,
      data: {
        notifications: transformedNotifications,
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to fetch notifications',
    });
  }
};

// Mark a notification as read
export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    }

    const { id } = markReadValidator.parse(req.params);

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true },
    );

    if (!notification)
      return res.status(404).json({ success: false, error: 'Notification not found' });

    res.json({ success: true, data: notification });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to mark notification as read',
    });
  }
};

// Mark all notifications as read
export const markAllRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    }

    const result = await Notification.updateMany({ userId, isRead: false }, { isRead: true });
    res.json({ success: true, data: { updatedCount: result.modifiedCount } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    });
  }
};

export const notificationHelper = async (
  type:
    | 'bySender'
    | 'byTraveller'
    | 'paymentSuccess'
    | 'paymentFailed'
    | 'consignmentCollected'
    | 'consignmentDelivered'
    | 'carryRequestExpired'
    | 'travelCancelled'
    | 'carryRequestAccepted'
    | 'handoverFailed',
  consignment: any,
  typeOfNotif: 'travel' | 'consignment' | 'general',
  userId: string | Types.ObjectId,
  acceptorUserId?: string | Types.ObjectId,
) => {
  const user = await User.findById(userId).select('firstName lastName');
  const name = user ? `${user.firstName} ${user.lastName}` : 'Unknown user';
  const receiverName = consignment.receiverName || 'The receiver';

  switch (type) {
    case 'bySender':
      return {
        title: 'New Carry Request',
        message: `${name} has requested you to carry their consignment.`,
        typeOfNotif,
      };
    case 'byTraveller':
      return {
        title: 'Interest to carry your consignment',
        message: `${name} has shown interest to carry your consignment to the destination city you published.`,
        typeOfNotif,
      };
    case 'paymentSuccess':
      return {
        title: 'Payment Successful',
        message: `Payment received for your consignment. ₹${consignment.amount} credited in your wallet.`,
        typeOfNotif,
      };
    case 'paymentFailed':
      return {
        title: 'Payment Failed',
        message: `Payment of ₹${consignment.amount} failed. Please try again.`,
        typeOfNotif,
      };
    case 'consignmentCollected':
      return {
        title: 'Consignment Handed Over',
        message: `You handed over your Consignment to ${name}.`,
        typeOfNotif,
      };
    case 'consignmentDelivered':
      return {
        title: 'Consignment Collected',
        message: `${receiverName} has collected the consignment from ${name}.`,
        typeOfNotif,
      };
    case 'carryRequestExpired':
      return {
        title: 'Carry Request Expired',
        message: `Your carry request for the consignment "${consignment.consignmentId}" has expired.`,
        typeOfNotif,
      };
    case 'travelCancelled':
      return {
        title: 'Travel Cancelled',
        message: `${name} has cancelled their travel. Your consignment "${consignment.consignmentId}" is affected.`,
        typeOfNotif,
      };
    case 'handoverFailed':
      return {
        title: 'Handover Failed',
        message: `Handover of your consignment "${consignment.consignmentId}" failed. Please contact the traveller.`,
        typeOfNotif,
      };
    // case 'carryRequestAccepted':
    //   return {
    //     title: 'Request Accepted',
    //     message: `Carry request of your consignment "${consignment.description}" has been accepted by ${name}. Please proceed to payment.`,
    //     typeOfNotif,
    //   };

    case 'carryRequestAccepted': {
      const acceptor = await User.findById(acceptorUserId).select('firstName lastName');
      const acceptorName = acceptor ? `${acceptor.firstName} ${acceptor.lastName}` : '';

      // Sender is the one receiving this notification
      const senderId = consignment?.senderId?.toString();
      const isSenderAccepting = senderId === acceptorUserId?.toString();

      return {
        title: 'Request Accepted',
        message: isSenderAccepting
          ? `Your carry request for "${consignment.description}" has been accepted. Please proceed to payment.`
          : `Your carry request for "${consignment.description}" has been accepted by ${acceptorName}. Please proceed to payment.`,
        typeOfNotif,
      };
    }

    default:
      return {
        title: 'Notification',
        message: 'You have a new update.',
        typeOfNotif,
      };
  }
};
