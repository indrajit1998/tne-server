import type { Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";
import type { AuthRequest } from "../../middlewares/authMiddleware.js";
import ConsignmentModel from "../../models/consignment.model.js";
import Earning from "../../models/earning.model.js";
import Payment from "../../models/payment.model.js";
import PayoutAccountsModel from "../../models/payoutaccounts.model.js";
import { TravelModel } from "../../models/travel.model.js";
import { User } from "../../models/user.model";
import {
  createBankFundAccount,
  createPayout,
  createRazorpayContactId,
  createVpaFundAccount,
  validateVpa,
} from "../../services/razorpay.service.js";

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const user = await User.findById(userId).select(
      "-__v -createdAt -updatedAt -_id"
    );
    if (!user) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "User not found"));
    }
    return res
      .status(CODES.OK)
      .json(sendResponse(CODES.OK, user, "User profile fetched successfully"));
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  }
};

export const getTravelAndConsignment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }
    const travels = await TravelModel.find({ travelerId: userId }).sort({
      createdAt: -1,
    });
    const consignments = await ConsignmentModel.find({ senderId: userId }).sort(
      { createdAt: -1 }
    );
    return res
      .status(CODES.OK)
      .json(
        sendResponse(
          CODES.OK,
          { travels, consignments },
          "Travel and Consignment data fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Something went wrong while fetching travel and consignment data"
        )
      );
  }
};

export const createRazorpayCustomerId = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user;
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "User not found"));
    }
    if (!user.onboardingCompleted) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(CODES.BAD_REQUEST, null, "User onboarding not completed")
        );
    }
    if (!user.email || !user.firstName || !user.lastName) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(CODES.BAD_REQUEST, null, "User email or name not found")
        );
    }
    const razorpayCustomerId = await createRazorpayContactId(
      `${user.firstName} ${user.lastName}`,
      user.email,
      user.phoneNumber
    );
    user.razorpayCustomerId = razorpayCustomerId;
    await user.save();
    return res
      .status(CODES.OK)
      .json(sendResponse(CODES.OK, { razorpayCustomerId }));
  } catch (error) {
    console.error("Error creating Razorpay customer ID:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  }
};

export const addFunds = async (req: AuthRequest, res: Response) => {
  try {
    const { type, details } = req.body;

    if (!type || !details) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(CODES.BAD_REQUEST, null, "All details are necessary")
        );
    }

    const userId = req.user;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "User not found"));
    }

    const userRazorpayCustomerId = user?.razorpayCustomerId;
    if (!userRazorpayCustomerId) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "Razorpay customer ID not found"
          )
        );
    }

    const name = `${user?.firstName} ${user?.lastName}`;
    let fundAccount;

    if (type === "bank_account") {
      fundAccount = await createBankFundAccount(
        String(userRazorpayCustomerId),
        details.name,
        details.ifsc,
        details.accountNumber
      );
    } else if (type === "vpa") {
      const isValidVpa = await validateVpa(details.vpa);
      if (!isValidVpa.success) {
        return res
          .status(CODES.BAD_REQUEST)
          .json(sendResponse(CODES.BAD_REQUEST, null, "Invalid VPA"));
      }

      fundAccount = await createVpaFundAccount(
        String(userRazorpayCustomerId),
        details.vpa
      );
    } else {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Invalid account type"));
    }

    const payout = await PayoutAccountsModel.create({
      userId,
      razorpayContactId: userRazorpayCustomerId,
      razorpayFundAccountId: fundAccount,
      displayName: name,
      accountType: type,
    });

    if (!payout) {
      return res
        .status(CODES.NO_CONTENT)
        .json(sendResponse(CODES.NO_CONTENT, null, "Payout not created"));
    }

    return res
      .status(CODES.CREATED)
      .json(sendResponse(CODES.CREATED, payout, "Payout created successfully"));
  } catch (error) {
    console.error("Error adding funds:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Something went wrong while adding funds"
        )
      );
  }
};

export const withdrawFunds = async (req: AuthRequest, res: Response) => {
  try {
    const { earningId } = req.body;
    const rawUser = req.user;
    const userId =
      typeof rawUser === "string"
        ? rawUser
        : (rawUser as JwtPayload & { _id: string })._id;

    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }
    const earning = await Earning.findById(earningId);
    if (!earning) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Earning not found"));
    }
    const amount = earning.amount;
    if (amount <= 0) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Invalid amount"));
    }
    const fundAccount = await PayoutAccountsModel.findOne({ userId });
    if (!fundAccount) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "No fund account found"));
    }
    const payoutId = await createPayout(
      fundAccount.razorpayFundAccountId,
      amount
    );

    if (!payoutId) {
      return res
        .status(CODES.INTERNAL_SERVER_ERROR)
        .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Payout failed"));
    }

    // 4. Record the payment
    const payment = await Payment.create({
      userId: new mongoose.Types.ObjectId(userId),
      travelId: earning.travelId,
      consignmentId: earning.consignmentId,
      amount,
      status: "pending",
      type: "traveller_earning",
      razorpayPaymentId: payoutId,
    });

    return res.json(
      sendResponse(CODES.CREATED, payment, "Withdraw request created")
    );
  } catch (error) {
    console.error("Error withdrawing funds:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Something went wrong while withdrawing funds"
        )
      );
  }
};
