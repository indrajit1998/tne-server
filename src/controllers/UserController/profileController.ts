import type { Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";
import type { AuthRequest } from "../../middlewares/authMiddleware.js";
import ConsignmentModel from "../../models/consignment.model.js";
import Earning from "../../models/earning.model.js";
import Payment from "../../models/payment.model.js";
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

    // ✅ Fetch user's travels
    const travels = await TravelModel.find({ travelerId: userId })
      .populate(
        "travelerId",
        "firstName lastName email rating reviewCount tripsCompleted profilePictureUrl isVerified phoneNumber"
      )
      .sort({ createdAt: -1 })
      .lean();

    // For each travel, attach consignments linked through TravelConsignments
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

        // Format coordinates for travel
        const formattedTravel = {
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
                // ✅ Include travelConsignmentId
                travelConsignmentId: tc._id,
                travelConsignmentStatus: tc.status,
              };
            })
            .filter(Boolean),
        };

        return formattedTravel;
      })
    );

    // ✅ Fetch user's consignments
    const consignments = await ConsignmentModel.find({ senderId: userId })
      .populate(
        "senderId",
        "firstName lastName email phoneNumber profilePictureUrl"
      )
      .sort({ createdAt: -1 })
      .lean();

    // For each consignment, attach travels linked through TravelConsignments
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

        // Format coordinates for consignment
        const formattedConsignment = {
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
                // ✅ Include travelConsignmentId
                travelConsignmentId: tc._id,
                travelConsignmentStatus: tc.status,
              };
            })
            .filter(Boolean),
        };

        return formattedConsignment;
      })
    );

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
    console.error("Error fetching travel and consignment data:", error);
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
      status: "completed",
      is_withdrawn: false,
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
    console.error("❌ Error fetching user earnings:", error);
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
