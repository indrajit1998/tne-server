import crypto from "crypto";
import type { Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";
import { encrypt, maskAccountNumber } from "../../lib/encryption.js";
import logger from "../../lib/logger.js";
import type { AuthRequest } from "../../middlewares/authMiddleware.js";
import ConsignmentModel from "../../models/consignment.model.js";
import Earning from "../../models/earning.model.js";
import Payment from "../../models/payment.model.js";
import { Payout } from "../../models/payout.model.js";
import PayoutAccountsModel from "../../models/payoutaccounts.model.js";
import { TravelModel } from "../../models/travel.model.js";
import TravelConsignments from "../../models/travelconsignments.model.js";
import { User } from "../../models/user.model";
import {
  createBankFundAccount,
  createPayout,
  createRazorpayContactId,
  createVpaFundAccount,
  validateVpa,
} from "../../services/razorpay.service.js";
import { updateUserProfileSchema } from "../../validations/userProfile.validator.js";

interface TravelConsignmentsPopulated
  extends Omit<TravelConsignments, "travelId"> {
  travelId: {
    _id: Types.ObjectId;
    travelerId: {
      _id: Types.ObjectId;
      firstName: string;
      lastName: string;
      rating?: number;
      reviewCount?: number;
      completedTrips?: number;
    };
  };
}

type Coordinates = {
  type: string;
  coordinates: [number, number];
};

// Define a type for populated user
interface PopulatedUser {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
}

// Define type for assigned traveller
interface AssignedTraveller {
  _id: Types.ObjectId;
  name: string;
  travelId: Types.ObjectId;
  phoneNumber?: string;
  profilePictureUrl?: string;
}

// const isPopulatedConsignment = (
//   consignment: unknown
// ): consignment is {
//   _id: Types.ObjectId;
//   fromCoordinates?: Coordinates;
//   toCoordinates?: Coordinates;
//   [key: string]: unknown;
// } => {
//   return (
//     !!consignment &&
//     typeof consignment === "object" &&
//     "_id" in consignment &&
//     !("_bsontype" in consignment) // ObjectId check (avoids ObjectId masquerading)
//   );
// };

// Helper function remains the same
function isPopulatedTravel(travel: any): boolean {
  return (
    travel &&
    typeof travel === "object" &&
    "_id" in travel &&
    "fromCoordinates" in travel
  );
}

function isPopulatedConsignment(consignment: any): boolean {
  return (
    consignment &&
    typeof consignment === "object" &&
    "_id" in consignment &&
    "fromCoordinates" in consignment
  );
}

const formatCoordinates = (coords?: Coordinates) => {
  if (!coords || !Array.isArray(coords.coordinates)) return null;
  return {
    latitude: coords.coordinates[1],
    longitude: coords.coordinates[0],
  };
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const user = await User.findById(userId).select(
      "-__v -createdAt -updatedAt"
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
    logger.error("Error fetching user profile:" + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  }
};

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    // Validate input with Zod
    const parseResult = updateUserProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e) => e.message);
      return res.status(400).json(sendResponse(400, null, errors.join(", ")));
    }

    const { firstName, lastName, email } = parseResult.data;

    const user = await User.findById(userId).select("-bankDetails -kyc -__v");

    if (!user) {
      return res.status(404).json(sendResponse(404, null, "User not found"));
    }

    // Restrict name updates if KYC verified
    if (user.isKYCVerified && (firstName || lastName)) {
      return res
        .status(400)
        .json(
          sendResponse(400, null, "Cannot update name after KYC verification")
        );
    }

    //  Apply allowed updates
    if (!user.isKYCVerified) {
      if (firstName) user.firstName = firstName.trim();
      if (lastName) user.lastName = lastName.trim();
    }
    if (email) user.email = email.trim();

    await user.save();

    return res
      .status(200)
      .json(sendResponse(200, user, "Profile updated successfully"));
  } catch (err) {
    console.error("Error updating user profile:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while updating profile",
    });
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

    const now = new Date();

    // ============================================================
    //  EXPIRATION LOGIC
    // ============================================================

    // 1: Expire travels that never started
    // Only expire "upcoming" travels that missed their expectedStartDate
    await TravelModel.updateMany(
      {
        status: "upcoming",
        expectedStartDate: { $lt: now },
      },
      { $set: { status: "expired" } }
    );

    // 2: Expire consignments that were never assigned
    // Expire "published" and "requested" consignments past their sendingDate
    // Optional: We can add 6-hour grace period by using new Date(now.getTime() - 6 * 60 * 60 * 1000)
    await ConsignmentModel.updateMany(
      {
        status: { $in: ["published", "requested"] },
        sendingDate: { $lt: now },
      },
      { $set: { status: "expired" } }
    );

    // Note: We do NOT expire:
    // - Travels with status "ongoing" (they're actively traveling)
    // - Consignments with status "assigned" or "in-transit" (delivery in progress)
    // This ensures active operations are never interrupted

    // 3: Fetch user's travels
    const travels = await TravelModel.find({ travelerId: userId })
      .populate(
        "travelerId",
        "firstName lastName email rating reviewCount tripsCompleted profilePictureUrl isVerified phoneNumber"
      )
      .sort({ createdAt: -1 })
      .lean();

    // 4: Enrich travels with consignments
    const enrichedTravels = await Promise.all(
      travels.map(async (travel) => {
        const travelConsignmentsLinked = await TravelConsignments.find({
          travelId: travel._id,
        })
          .populate({
            path: "consignmentId",
            select:
              "fromAddress toAddress fromCoordinates toCoordinates weight dimensions category description status receiverName receiverPhone",
          })
          .lean();

        return {
          ...travel,
          fromCoordinates: formatCoordinates(
            travel.fromCoordinates as Coordinates
          ),
          toCoordinates: formatCoordinates(travel.toCoordinates as Coordinates),
          consignments: travelConsignmentsLinked
            .map((tc) => {
              const consignment = tc.consignmentId as any;
              if (!isPopulatedConsignment(consignment)) return null;

              return {
                ...consignment,
                fromCoordinates: formatCoordinates(consignment.fromCoordinates),
                toCoordinates: formatCoordinates(consignment.toCoordinates),
                travelConsignmentId: tc._id,
                travelConsignmentStatus: tc.status,
              };
            })
            .filter(Boolean),
        };
      })
    );

    // 5: Fetch user's consignments
    const consignments = await ConsignmentModel.find({ senderId: userId })
      .populate(
        "senderId",
        "firstName lastName email phoneNumber profilePictureUrl"
      )
      .sort({ createdAt: -1 })
      .lean();

    // 6: Enrich consignments with travels
    const enrichedConsignments = await Promise.all(
      consignments.map(async (consignment) => {
        const travelConsignmentsLinked = await TravelConsignments.find({
          consignmentId: consignment._id,
        })
          .populate({
            path: "travelId",
            select:
              "fromAddress toAddress fromCoordinates toCoordinates expectedStartDate expectedEndDate modeOfTravel status travelerId",
            populate: {
              path: "travelerId",
              select:
                "firstName lastName email rating reviewCount tripsCompleted profilePictureUrl isVerified phoneNumber",
            },
          })
          .lean();

        return {
          ...consignment,
          fromCoordinates: formatCoordinates(
            consignment.fromCoordinates as Coordinates
          ),
          toCoordinates: formatCoordinates(
            consignment.toCoordinates as Coordinates
          ),
          travels: travelConsignmentsLinked
            .map((tc) => {
              const travel = tc.travelId as any;
              if (!isPopulatedTravel(travel)) return null;

              return {
                ...travel,
                fromCoordinates: formatCoordinates(travel.fromCoordinates),
                toCoordinates: formatCoordinates(travel.toCoordinates),
                travelConsignmentId: tc._id,
                travelConsignmentStatus: tc.status,
              };
            })
            .filter(Boolean),
        };
      })
    );

    // 7: Return response
    return res
      .status(CODES.OK)
      .json(
        sendResponse(
          CODES.OK,
          { travels: enrichedTravels, consignments: enrichedConsignments },
          "Travel and Consignment data fetched successfully"
        )
      );
  } catch (error) {
    logger.error("Error fetching travel and consignment data:" + error);
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
    logger.error("Error creating Razorpay customer ID:" + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  }
};

export const getUserBankDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const user = await User.findById(userId).select("bankDetails").lean();

    if (!user || !user.bankDetails) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "Bank details not found"));
    }

    console.log("BANK DETAILS IN BE => ", user.bankDetails);

    // Return masked bank details
    return res.status(CODES.OK).json(
      sendResponse(CODES.OK, {
        accountHolderName: user.bankDetails.accountHolderName,
        accountNumber: user.bankDetails.accountNumber, // already masked
        ifscCode: user.bankDetails.ifscCode,
        bankName: user.bankDetails.bankName,
        branch: user.bankDetails.branch,
        isVerified: user.bankDetails.isVerified,
        razorpayFundAccountId: user.bankDetails.razorpayFundAccountId,
      })
    );
  } catch (error) {
    logger.error("Error fetching bank details:" + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Something went wrong while fetching bank details"
        )
      );
  }
};

// Get user's bank details from profile
export const getUserFundAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const fundAccounts = await PayoutAccountsModel.find({ userId }).lean();

    if (fundAccounts.length === 0) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "Fund accounts not found"));
    }

    return res
      .status(CODES.OK)
      .json(sendResponse(CODES.OK, fundAccounts, "Fund accounts fetched"));
  } catch (error) {
    logger.error("Error fetching fund accounts:" + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Something went wrong while fetching fund accounts"
        )
      );
  }
};

// Save or update bank details in profile
export const saveUserBankDetails = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.user;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const { accountHolderName, accountNumber, ifscCode, bankName, branch } =
      req.body;

    // Validation
    if (
      !accountHolderName ||
      !accountNumber ||
      !ifscCode ||
      !bankName ||
      !branch
    ) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(CODES.BAD_REQUEST, null, "All bank details are required")
        );
    }

    // Validate IFSC
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(CODES.BAD_REQUEST, null, "Invalid IFSC code format")
        );
    }

    // Validate account number
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "Invalid account number (9-18 digits)"
          )
        );
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "User not found"));
    }

    // Encrypt and mask the account number
    const encryptedAccountNumber = encrypt(accountNumber);
    const maskedAccountNumber = maskAccountNumber(accountNumber);
    const accountHash = crypto
      .createHash("sha256")
      .update(accountNumber)
      .digest("hex");

    session.startTransaction();

    // Create Razorpay contact if not exists
    let razorpayContactId = user.razorpayCustomerId;
    if (!razorpayContactId) {
      razorpayContactId = await createRazorpayContactId(
        `${user.firstName} ${user.lastName}`,
        user.email || "",
        user.phoneNumber
      );
      user.razorpayCustomerId = razorpayContactId;
    }

    // Create Razorpay fund account
    let razorpayFundAccountId: string | undefined;

    // Check if fund account already exists in PayoutAccounts
    const existingFundAccount = await PayoutAccountsModel.findOne({
      userId,
      accountHash,
      accountType: "bank_account",
    }).session(session);

    if (existingFundAccount) {
      razorpayFundAccountId = existingFundAccount.razorpayFundAccountId;
    } else {
      // Create new fund account on Razorpay
      razorpayFundAccountId = await createBankFundAccount(
        razorpayContactId,
        accountHolderName,
        ifscCode.toUpperCase(),
        accountNumber
      );

      // Save to PayoutAccounts table
      await PayoutAccountsModel.create(
        [
          {
            userId,
            razorpayContactId,
            razorpayFundAccountId,
            displayName: `${user.firstName} ${user.lastName}`,
            accountType: "bank_account",
            accountNumber: maskedAccountNumber,
            accountNumberEncrypted: encryptedAccountNumber,
            bankName,
            branch,
            accountHash,
          },
        ],
        { session }
      );
    }

    // Update user's bank details
    user.bankDetails = {
      accountHolderName,
      accountNumber: maskedAccountNumber, // for frontend
      accountNumberEncrypted: encryptedAccountNumber, // for admin access
      ifscCode: ifscCode.toUpperCase(),
      bankName,
      branch,
      accountHash,
      razorpayFundAccountId,
      isVerified: true,
      createdAt: user.bankDetails?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await user.save({ session });
    await session.commitTransaction();

    logger.info("Bank details saved successfully for user:" + userId);

    return res.status(CODES.OK).json(
      sendResponse(
        CODES.OK,
        {
          accountHolderName: user.bankDetails.accountHolderName,
          accountNumber: user.bankDetails.accountNumber,
          ifscCode: user.bankDetails.ifscCode,
          bankName: user.bankDetails.bankName,
          branch: user.bankDetails.branch,
          isVerified: user.bankDetails.isVerified,
          razorpayFundAccountId: user.bankDetails.razorpayFundAccountId,
        },
        "Bank details saved successfully"
      )
    );
  } catch (error: any) {
    await session.abortTransaction();
    logger.error("Error saving bank details:" + error);

    const status = error?.status || CODES.INTERNAL_SERVER_ERROR;
    const message = error?.message || "Failed to save bank details";

    return res.status(status).json(sendResponse(status, null, message));
  } finally {
    session.endSession();
  }
};

export const addFundAccount = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const { type, details } = req.body;

    // Only support bank_account now (keeping code extensible for future)
    if (type !== "bank_account") {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "Only bank account is supported"
          )
        );
    }

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

    // ⚠️ NOTE: Misnamed field — 'razorpayCustomerId' is actually the Razorpay Contact ID
    let razorpayContactId = user.razorpayCustomerId;

    if (!razorpayContactId) {
      // Automatically create Razorpay contact for this user
      logger.info("Razorpay customer ID not found — creating new one...");

      if (!user.email) {
        // Optionally, you can generate a placeholder email if none exists
        logger.warn(
          "No user email found — using placeholder for Razorpay contact creation"
        );
      }

      // Create Razorpay contact
      try {
        razorpayContactId = await createRazorpayContactId(
          `${user.firstName} ${user.lastName}`,
          user.email || "",
          user.phoneNumber
        );

        // Save in DB (field still named 'razorpayCustomerId')
        user.razorpayCustomerId = razorpayContactId;
        await user.save();

        logger.info("Razorpay customer ID created:" + razorpayContactId);
      } catch (err) {
        logger.error("Failed to create Razorpay customer ID:" + err);
        return res
          .status(CODES.INTERNAL_SERVER_ERROR)
          .json(
            sendResponse(
              CODES.INTERNAL_SERVER_ERROR,
              null,
              "Failed to create Razorpay customer ID"
            )
          );
      }
    }

    const displayName = `${user.firstName} ${user.lastName}`;

    const payoutAccount = await session.withTransaction(async () => {
      let fundAccountId: string;
      let maskedDetails: any = {};

      if (type === "bank_account") {
        const { accountNumber, bankName, branch, ifsc, name } = details;

        if (!accountNumber || !bankName || !branch || !ifsc || !name) {
          throw {
            status: CODES.BAD_REQUEST,
            message: "Incomplete bank account details",
          };
        }

        if (ifsc.length !== 11) {
          throw { status: CODES.BAD_REQUEST, message: "Invalid IFSC code" };
        }

        // Mask and hash
        const accountHash = crypto
          .createHash("sha256")
          .update(accountNumber)
          .digest("hex");
        maskedDetails.accountNumber =
          accountNumber.length > 4
            ? "****" + accountNumber.slice(-4)
            : accountNumber;
        maskedDetails.bankName = bankName;
        maskedDetails.branch = branch;

        // Duplicate check
        const existing = await PayoutAccountsModel.findOne({
          userId,
          accountHash,
          accountType: "bank_account",
        }).session(session);

        if (existing) {
          throw {
            status: CODES.BAD_REQUEST,
            message: "Bank account already added",
          };
        }

        // Create fund account on Razorpay
        fundAccountId = await createBankFundAccount(
          razorpayContactId,
          name,
          ifsc,
          accountNumber
        );

        // Save in PayoutAccounts
        const newAccount = await PayoutAccountsModel.create(
          [
            {
              userId,
              razorpayContactId, // still named razorpayCustomerId in DB
              razorpayFundAccountId: fundAccountId,
              displayName,
              accountType: "bank_account",
              ...maskedDetails,
              accountHash,
            },
          ],
          { session }
        );

        if (!newAccount || !newAccount[0])
          throw {
            status: CODES.INTERNAL_SERVER_ERROR,
            message: "Failed to create fund account",
          };

        // SYNC: Update user's bank details in profile
        user.bankDetails = {
          accountHolderName: name,
          accountNumber: maskedDetails.accountNumber,
          ifscCode: ifsc.toUpperCase(),
          bankName,
          branch,
          accountHash,
          razorpayFundAccountId: fundAccountId,
          isVerified: true,
          createdAt: user.bankDetails?.createdAt || new Date(),
          updatedAt: new Date(),
        };

        await user.save({ session });

        return newAccount[0];
      } else if (type === "vpa") {
        const { vpa } = details;
        if (!vpa)
          throw { status: CODES.BAD_REQUEST, message: "VPA is required" };

        const isValidVpa = await validateVpa(vpa);
        if (!isValidVpa.success)
          throw { status: CODES.BAD_REQUEST, message: "Invalid VPA" };

        const vpaHash = crypto.createHash("sha256").update(vpa).digest("hex");
        maskedDetails.vpa = vpa.replace(/(.{2}).+(@.+)/, "$1***$2");

        const existing = await PayoutAccountsModel.findOne({
          userId,
          accountHash: vpaHash,
          accountType: "vpa",
        }).session(session);

        if (existing)
          throw { status: CODES.BAD_REQUEST, message: "VPA already added" };

        fundAccountId = await createVpaFundAccount(razorpayContactId, vpa);

        const newAccount = await PayoutAccountsModel.create(
          [
            {
              userId,
              razorpayContactId,
              razorpayFundAccountId: fundAccountId,
              displayName,
              accountType: "vpa",
              ...maskedDetails,
              accountHash: vpaHash,
            },
          ],
          { session }
        );

        if (!newAccount || !newAccount[0])
          throw {
            status: CODES.INTERNAL_SERVER_ERROR,
            message: "Failed to create VPA account",
          };

        return newAccount[0];
      } else {
        throw { status: CODES.BAD_REQUEST, message: "Invalid account type" };
      }
    });

    return res
      .status(CODES.CREATED)
      .json(
        sendResponse(
          CODES.CREATED,
          payoutAccount,
          "Fund account added successfully"
        )
      );
  } catch (error: any) {
    logger.error("Error adding fund account:" + error);

    // Custom error handling
    const status = error?.status || CODES.INTERNAL_SERVER_ERROR;
    const message =
      error?.message || "Something went wrong while adding fund account";

    return res.status(status).json(sendResponse(status, null, message));
  } finally {
    session.endSession();
  }
};

export const withdrawFunds = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const { earningId, fundAccountId } = req.body;
    const rawUser = req.user;
    const userId =
      typeof rawUser === "string"
        ? rawUser
        : (rawUser as JwtPayload & { _id: string })._id;

    console.log("fundAccountId => ", fundAccountId);
    console.log("earningId => ", earningId);

    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    // 1. Fetch earning
    const earning = await Earning.findById(earningId).session(session);
    if (!earning) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Earning not found"));
    }

    if (String(earning.userId) !== String(userId)) {
      return res
        .status(CODES.FORBIDDEN)
        .json(sendResponse(CODES.FORBIDDEN, null, "Not owner of this earning"));
    }

    if (earning.is_withdrawn) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Already withdrawn"));
    }

    if (earning.status !== "completed") {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Earning not completed"));
    }

    const amount = Number(earning.amount || 0);
    if (amount <= 0) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Invalid amount"));
    }

    // 2. Fetch user's fund account
    const fundAccount = await PayoutAccountsModel.findOne({
      userId,
      razorpayFundAccountId: fundAccountId,
    }).session(session);
    if (!fundAccount) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "Invalid or missing fund account"
          )
        );
    }

    // 3. Start transaction
    let localPayout: any;
    await session.withTransaction(async () => {
      // Mark earning as payoutPending
      const updated = await Earning.findOneAndUpdate(
        { _id: earning._id, is_withdrawn: false, payoutId: { $exists: false } },
        { $set: { payoutPending: true } },
        { new: true, session }
      );

      if (!updated) throw new Error("Earning already linked or withdrawn");

      // Create local payout
      const clientPayoutId = uuidv4();
      const payoutDoc = await Payout.create(
        [
          {
            userId: new mongoose.Types.ObjectId(userId),
            travelId: earning.travelId ?? undefined,
            consignmentId: earning.consignmentId ?? undefined,
            amount,
            status: "pending",
            razorpayPayoutId: "",
            clientPayoutId,
            earningIds: [earning._id],
          },
        ],
        { session }
      );

      if (!payoutDoc || !payoutDoc[0])
        throw new Error("Failed to create local payout record");

      localPayout = payoutDoc[0];

      // Link earning -> payoutId
      await Earning.updateOne(
        { _id: earning._id },
        { $set: { payoutId: localPayout._id } },
        { session }
      );
    });

    // 4. Prepare Razorpay notes
    const notes: Record<string, string> = {
      userId: String(userId),
      payoutId: String(localPayout.clientPayoutId),
      earningIds: JSON.stringify([String(earning._id)]),
      consignmentId: earning.consignmentId ? String(earning.consignmentId) : "",
      travelId: earning.travelId ? String(earning.travelId) : "",
    };

    logger.info(
      "Creating Razorpay payout with notes: " + JSON.stringify(notes)
    );

    // 5. Call Razorpay
    let razorpayResponse;
    try {
      razorpayResponse = await createPayout(
        fundAccount.razorpayFundAccountId,
        amount,
        {
          notes,
          idempotencyKey: localPayout.clientPayoutId.toString(),
          mode: fundAccount.accountType === "vpa" ? "UPI" : "IMPS",
        }
      );
    } catch (err: any) {
      logger.error(
        "Razorpay create payout failed:",
        err.message || JSON.stringify(err)
      );

      // Mark payout failed and revert earning
      await Payout.findByIdAndUpdate(localPayout._id, {
        status: "failed",
        failureReason: err.message || "Razorpay create failed",
      });

      await Earning.updateOne(
        { _id: earning._id },
        {
          $unset: { payoutPending: true, payoutId: "" },
          $set: { is_withdrawn: false },
        }
      );

      return res
        .status(CODES.INTERNAL_SERVER_ERROR)
        .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Payout failed"));
    }

    // 6. Update local payout with Razorpay ID
    await Payout.findByIdAndUpdate(localPayout._id, {
      $set: {
        razorpayPayoutId: razorpayResponse?.id,
        status: "processing",
        notes,
      },
    });

    // 7. Record Payment
    const payment = await Payment.create({
      userId: new mongoose.Types.ObjectId(userId),
      travelId: earning.travelId,
      consignmentId: earning.consignmentId,
      amount,
      status: "pending",
      type: "traveller_earning",
      razorpayPaymentId: razorpayResponse?.id,
    });

    logger.info("Withdraw request created successfully for userId:" + userId);

    return res.status(CODES.CREATED).json(
      sendResponse(CODES.CREATED, {
        payout: {
          id: localPayout._id,
          razorpayPayoutId: razorpayResponse?.id,
          status: "processing",
        },
        payment,
      })
    );
  } catch (error) {
    logger.error("Error withdrawing funds: " + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  } finally {
    session.endSession();
  }
};

export const getUserEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }

    const earnings = await Earning.find({
      userId,
      status: "completed", // Only delivered consignments
      is_withdrawn: false,
      payoutId: { $exists: false }, //Exclude processing payouts
    })
      .populate("consignmentId", "description fromAddress toAddress")
      .populate("travelId", "fromAddress toAddress modeOfTravel")
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = earnings.reduce(
      (sum, earning) => sum + (earning.amount || 0),
      0
    );

    return res.json(
      sendResponse(CODES.OK, {
        totalEarnings,
        availableForWithdrawal: totalEarnings,
        earnings,
      })
    );
  } catch (error) {
    logger.error("❌ Error fetching user earnings:" + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Internal server error while fetching earnings"
        )
      );
  }
};
