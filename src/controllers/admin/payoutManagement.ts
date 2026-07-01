import type { Response } from "express";
import mongoose from "mongoose";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import Earning from "../../models/earning.model";
import { Payout } from "../../models/payout.model";
import { User } from "../../models/user.model";
import { decrypt } from "../../lib/encryption.js";
import logger from "../../lib/logger.js";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";

export const getPayouts = async (req: AdminAuthRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const [total, payouts] = await Promise.all([
      Payout.countDocuments(query),
      Payout.find(query)
        .populate("userId", "firstName lastName email phoneNumber bankDetails")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const enrichedPayouts = payouts.map((payout: any) => {
      const user = payout.userId;
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
        ...payout,
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
        data: enrichedPayouts,
      }, "Payouts fetched successfully")
    );
  } catch (error) {
    logger.error("Error fetching payouts: " + error);
    return res.status(CODES.INTERNAL_SERVER_ERROR).json(
      sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
    );
  }
};

export const updatePayoutStatus = async (req: AdminAuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    if (status !== undefined && !["pending", "initiated", "paid", "rejected"].includes(status)) {
      return res.status(CODES.BAD_REQUEST).json(
        sendResponse(CODES.BAD_REQUEST, null, "Invalid status")
      );
    }

    const payout = await Payout.findById(id).session(session);
    if (!payout) {
      return res.status(CODES.NOT_FOUND).json(
        sendResponse(CODES.NOT_FOUND, null, "Payout request not found")
      );
    }

    session.startTransaction();

    const previousStatus = payout.status;

    if (status !== undefined) {
      payout.status = status;
    }
    if (comment !== undefined) {
      payout.comment = comment;
    }

    await payout.save({ session });

    // Only apply transaction actions if status has actually changed
    if (status !== undefined && status !== previousStatus) {
      if (status === "paid") {
        // Mark all linked earnings as withdrawn
        await Earning.updateMany(
          { _id: { $in: payout.earningIds } },
          {
            $set: {
              is_withdrawn: true,
              withdrawnAt: new Date(),
              payoutPending: false,
            },
          },
          { session }
        );
      } else if (status === "rejected") {
        // Revert earnings back to available for withdrawal
        await Earning.updateMany(
          { _id: { $in: payout.earningIds } },
          {
            $set: { payoutPending: false },
            $unset: { payoutId: "" },
          },
          { session }
        );
      } else if (previousStatus === "rejected" && (status === "pending" || status === "initiated")) {
        // If it was rejected previously, and is re-opened/re-initiated, we link them back
        await Earning.updateMany(
          { _id: { $in: payout.earningIds } },
          {
            $set: {
              payoutPending: true,
              payoutId: payout._id
            }
          },
          { session }
        );
      } else if (previousStatus === "paid" && (status === "pending" || status === "initiated" || status === "rejected")) {
        // If it was paid previously, and is reverted, we reset the earnings is_withdrawn
        await Earning.updateMany(
          { _id: { $in: payout.earningIds } },
          {
            $set: {
              is_withdrawn: false,
              payoutPending: status !== "rejected",
            },
            ...(status === "rejected" ? { $unset: { payoutId: "" } } : { $set: { payoutId: payout._id } })
          },
          { session }
        );
      }
    }

    await session.commitTransaction();
    logger.info(`Payout ID: ${id} updated (Status: ${payout.status}, Comment: ${payout.comment})`);

    return res.status(CODES.OK).json(
      sendResponse(CODES.OK, payout, "Payout request updated successfully")
    );
  } catch (error) {
    await session.abortTransaction();
    logger.error("Error updating payout status: " + error);
    return res.status(CODES.INTERNAL_SERVER_ERROR).json(
      sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
    );
  } finally {
    session.endSession();
  }
};

export const exportPayouts = async (req: AdminAuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const query: any = {};
    if (status) {
      query.status = status;
    }

    const payouts = await Payout.find(query)
      .populate("userId", "firstName lastName bankDetails")
      .sort({ createdAt: -1 })
      .lean();

    let csvContent = "Payout ID,Customer Name,Account Holder Name,Bank Name,Account Number,IFSC,Branch,Amount,Status,Created At\n";

    for (const payout of payouts) {
      const user: any = payout.userId;
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
      const amount = payout.amount || 0;
      const payoutStatus = payout.status;
      const createdAt = payout.createdAt ? new Date(payout.createdAt).toISOString() : "";

      // Escape quotes and wrap in quotes to prevent CSV injection / parsing issues
      const row = [
        payout._id.toString(),
        `"${customerName.replace(/"/g, '""')}"`,
        `"${accountHolderName.replace(/"/g, '""')}"`,
        `"${bankName.replace(/"/g, '""')}"`,
        `"${decryptedAccountNumber.replace(/"/g, '""')}"`,
        `"${ifscCode.replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        amount,
        payoutStatus,
        createdAt
      ].join(",");

      csvContent += row + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=payouts_${status || "all"}_export.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    logger.error("Error exporting payouts: " + error);
    return res.status(CODES.INTERNAL_SERVER_ERROR).json(
      sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
    );
  }
};
