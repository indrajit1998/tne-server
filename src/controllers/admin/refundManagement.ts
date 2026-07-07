import type { Response } from "express";
import mongoose from "mongoose";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { Refund } from "../../models/refund.model";
import Payment from "../../models/payment.model";
import { User } from "../../models/user.model";
import { decrypt } from "../../lib/encryption.js";
import logger from "../../lib/logger.js";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";
import { notifyUser } from "../../lib/pushNotification";

export const getRefunds = async (req: AdminAuthRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const [total, refunds] = await Promise.all([
      Refund.countDocuments(query),
      Refund.find(query)
        .populate("userId", "firstName lastName email phoneNumber bankDetails")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const enrichedRefunds = refunds.map((refund: any) => {
      const user = refund.userId;
      let decryptedAccountNumber = "";
      if (user?.bankDetails?.accountNumberEncrypted) {
        try {
          decryptedAccountNumber = decrypt(user.bankDetails.accountNumberEncrypted);
        } catch (err) {
          decryptedAccountNumber = "Decryption Error";
        }
      } else {
        decryptedAccountNumber = user?.bankDetails?.accountNumber || "";
      }

      return {
        ...refund,
        user: user ? {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
        } : null,
        bankDetails: user?.bankDetails ? {
          accountHolderName: user.bankDetails.accountHolderName,
          bankName: user.bankDetails.bankName,
          branch: user.bankDetails.branch,
          ifscCode: user.bankDetails.ifscCode,
          accountNumber: decryptedAccountNumber,
        } : null,
      };
    });

    return res.status(CODES.OK).json(
      sendResponse(CODES.OK, {
        total,
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        data: enrichedRefunds,
      }, "Refunds fetched successfully")
    );
  } catch (error) {
    logger.error("Error fetching refunds: " + error);
    return res.status(CODES.INTERNAL_SERVER_ERROR).json(
      sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
    );
  }
};

export const updateRefundStatus = async (req: AdminAuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    if (status !== undefined && !["pending", "initiated", "processed", "rejected"].includes(status)) {
      return res.status(CODES.BAD_REQUEST).json(
        sendResponse(CODES.BAD_REQUEST, null, "Invalid status")
      );
    }

    const refund = await Refund.findById(id).session(session);
    if (!refund) {
      return res.status(CODES.NOT_FOUND).json(
        sendResponse(CODES.NOT_FOUND, null, "Refund request not found")
      );
    }

    session.startTransaction();

    const previousStatus = refund.status;

    if (status !== undefined) {
      refund.status = status;
    }
    if (comment !== undefined) {
      refund.comment = comment;
    }

    await refund.save({ session });

    // Update the associated payment if status changed
    if (status !== undefined && status !== previousStatus) {
      const payment = await Payment.findById(refund.paymentId).session(session);
      if (payment) {
        if (status === "processed") {
          payment.status = "refunded";
          if (payment.refundDetails) payment.refundDetails.status = "processed";
        } else if (status === "rejected") {
          // If refund is rejected, payment is still marked as completed or maybe we just leave it refund_pending/completed
          // Typically if rejected, it means refund not possible. Let's revert payment status to completed
          payment.status = "completed";
          if (payment.refundDetails) payment.refundDetails.status = "failed";
        } else if (status === "pending" || status === "initiated") {
          payment.status = "refund_pending";
          if (payment.refundDetails) payment.refundDetails.status = "pending";
        }
        await payment.save({ session });
      }
    }

    await session.commitTransaction();
    logger.info(`Refund ID: ${id} updated (Status: ${refund.status}, Comment: ${refund.comment})`);
    
    // Notifications
    if (status !== undefined && status !== previousStatus) {
      let message = `Your refund status is now ${status}.`;
      if (status === "processed") message = `Your refund of ₹${refund.amount} has been processed successfully.`;
      if (status === "rejected") message = `Your refund of ₹${refund.amount} was rejected.`;
      
      await notifyUser(refund.userId.toString(), "Refund Status Updated", message);
    }

    return res.status(CODES.OK).json(
      sendResponse(CODES.OK, refund, "Refund request updated successfully")
    );
  } catch (error) {
    await session.abortTransaction();
    logger.error("Error updating refund status: " + error);
    return res.status(CODES.INTERNAL_SERVER_ERROR).json(
      sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
    );
  } finally {
    session.endSession();
  }
};

export const exportRefunds = async (req: AdminAuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const query: any = {};
    if (status) {
      query.status = status;
    }

    const refunds = await Refund.find(query)
      .populate("userId", "firstName lastName bankDetails")
      .sort({ createdAt: -1 })
      .lean();

    let csvContent = "Refund Request ID,Payment ID,Customer Name,Account Holder Name,Bank Name,Account Number,IFSC,Branch,Amount,Status,Created At\n";

    for (const refund of refunds) {
      const user: any = refund.userId;
      let decryptedAccountNumber = "";
      if (user?.bankDetails?.accountNumberEncrypted) {
        try {
          decryptedAccountNumber = decrypt(user.bankDetails.accountNumberEncrypted);
        } catch (err) {
          decryptedAccountNumber = "Decryption Error";
        }
      } else {
        decryptedAccountNumber = user?.bankDetails?.accountNumber || "";
      }

      const customerName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
      const accountHolderName = user?.bankDetails?.accountHolderName || "";
      const bankName = user?.bankDetails?.bankName || "";
      const ifscCode = user?.bankDetails?.ifscCode || "";
      const branch = user?.bankDetails?.branch || "";
      const amount = refund.amount || 0;
      const refundStatus = refund.status;
      const createdAt = refund.createdAt ? new Date(refund.createdAt).toISOString() : "";

      // Escape quotes and wrap in quotes to prevent CSV injection / parsing issues
      const row = [
        refund._id.toString(),
        refund.paymentId?.toString() || "",
        `"${customerName.replace(/"/g, '""')}"`,
        `"${accountHolderName.replace(/"/g, '""')}"`,
        `"${bankName.replace(/"/g, '""')}"`,
        `"${decryptedAccountNumber.replace(/"/g, '""')}"`,
        `"${ifscCode.replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        amount,
        refundStatus,
        createdAt
      ].join(",");

      csvContent += row + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=refunds_${status || "all"}_export.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    logger.error("Error exporting refunds: " + error);
    return res.status(CODES.INTERNAL_SERVER_ERROR).json(
      sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
    );
  }
};
