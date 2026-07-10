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
import { notifyUser } from "../../lib/pushNotification";
import * as XLSX from "xlsx";

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
      const encString =
        user?.bankDetails?.accountNumberEncrypted ||
        user?.bankDetails?.accountHash;
      if (encString) {
        try {
          decryptedAccountNumber = decrypt(encString);
        } catch (err: any) {
          console.error(
            `[getPayouts] Decryption error for user ${user._id}. Encrypted: ${encString}, Error: ${err.message}`,
          );
          decryptedAccountNumber = "Decryption Error";
        }
      } else {
        decryptedAccountNumber = user?.bankDetails?.accountNumber || "";
      }

      return {
        ...payout,
        user: user
          ? {
              _id: user._id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phoneNumber: user.phoneNumber,
            }
          : null,
        bankDetails: user?.bankDetails
          ? {
              accountHolderName: user.bankDetails.accountHolderName,
              bankName: user.bankDetails.bankName,
              branch: user.bankDetails.branch,
              ifscCode: user.bankDetails.ifscCode,
              accountNumber: decryptedAccountNumber,
            }
          : null,
      };
    });

    return res.status(CODES.OK).json(
      sendResponse(
        CODES.OK,
        {
          total,
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          data: enrichedPayouts,
        },
        "Payouts fetched successfully",
      ),
    );
  } catch (error) {
    logger.error("Error fetching payouts: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong"),
      );
  }
};

export const updatePayoutStatus = async (
  req: AdminAuthRequest,
  res: Response,
) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    if (
      status !== undefined &&
      !["pending", "initiated", "paid", "rejected"].includes(status)
    ) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Invalid status"));
    }

    const payout = await Payout.findById(id).session(session);
    if (!payout) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "Payout request not found"));
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
          { session },
        );
      } else if (status === "rejected") {
        // Revert earnings back to available for withdrawal
        await Earning.updateMany(
          { _id: { $in: payout.earningIds } },
          {
            $set: { payoutPending: false },
            $unset: { payoutId: "" },
          },
          { session },
        );
      } else if (
        previousStatus === "rejected" &&
        (status === "pending" || status === "initiated")
      ) {
        // If it was rejected previously, and is re-opened/re-initiated, we link them back
        await Earning.updateMany(
          { _id: { $in: payout.earningIds } },
          {
            $set: {
              payoutPending: true,
              payoutId: payout._id,
            },
          },
          { session },
        );
      } else if (
        previousStatus === "paid" &&
        (status === "pending" ||
          status === "initiated" ||
          status === "rejected")
      ) {
        // If it was paid previously, and is reverted, we reset the earnings is_withdrawn
        await Earning.updateMany(
          { _id: { $in: payout.earningIds } },
          {
            $set: {
              is_withdrawn: false,
              payoutPending: status !== "rejected",
            },
            ...(status === "rejected"
              ? { $unset: { payoutId: "" } }
              : { $set: { payoutId: payout._id } }),
          },
          { session },
        );
      }
    }

    await session.commitTransaction();
    logger.info(
      `Payout ID: ${id} updated (Status: ${payout.status}, Comment: ${payout.comment})`,
    );

    if (status !== undefined && status !== previousStatus) {
      let message = `Your payout status is now ${status}.`;
      if (status === "paid")
        message = `Your payout of ₹${payout.amount} has been paid successfully.`;
      if (status === "rejected")
        message = `Your payout of ₹${payout.amount} was rejected.`;

      await notifyUser(payout.userId, "Payout Status Updated", message);
    }

    return res
      .status(CODES.OK)
      .json(
        sendResponse(CODES.OK, payout, "Payout request updated successfully"),
      );
  } catch (error) {
    await session.abortTransaction();
    logger.error("Error updating payout status: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong"),
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
      .populate("userId", "firstName lastName bankDetails email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      "Beneficiary Name",
      "Beneficiary Account Number",
      "IFSC",
      "Txn Type",
      "Debit Account Number",
      "Value Date",
      "Amount",
      "Currency",
      "Email",
      "Remarks",
      "Beneficiary Mobile",
    ];

    const dataRows = payouts.map((payout: any) => {
      const user: any = payout.userId;
      let decryptedAccountNumber = "";
      const encString =
        user?.bankDetails?.accountNumberEncrypted ||
        user?.bankDetails?.accountHash;
      if (encString) {
        try {
          decryptedAccountNumber = decrypt(encString);
        } catch (err: any) {
          console.error(
            `[exportPayouts] Decryption error for user ${user?._id}. Encrypted: ${encString}, Error: ${err.message}`,
          );
          decryptedAccountNumber = "XXXXXXXXXXX";
        }
      } else {
        decryptedAccountNumber = user?.bankDetails?.accountNumber || "";
        if (decryptedAccountNumber === "Decryption Error") {
          decryptedAccountNumber = "XXXXXXXXXXX";
        }
      }

      const bankName = user?.bankDetails?.bankName?.toLowerCase() || "";
      const isIdfc = bankName.includes("idfc");
      const amount = payout.amount || 0;
      const txnType = isIdfc ? "IFT" : amount >= 200000 ? "RTGS" : "NEFT";

      const formattedDate = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
        .format(new Date())
        .replace(/ /g, "-");

      return [
        user?.bankDetails?.accountHolderName || user?.firstName || "",
        decryptedAccountNumber,
        user?.bankDetails?.ifscCode || "",
        txnType,
        "", // Debit Account Number (admin to fill)
        formattedDate,
        amount,
        "INR",
        user?.email || "",
        `Payout ${payout._id}`,
        user?.phoneNumber || "",
      ];
    });

    const worksheetData = [headers, ...dataRows];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payouts_${status || "all"}_export.xlsx`,
    );
    return res.status(200).send(buffer);
  } catch (error) {
    logger.error("Error exporting payouts: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong"),
      );
  }
};
