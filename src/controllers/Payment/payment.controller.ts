import axios from "axios";
import crypto from "crypto";
import type { Response } from "express";
import { request } from "http";
import mongoose from "mongoose";
import env from "../../lib/env";
import logger from "../../lib/logger";
import { generateOtp } from "../../lib/utils";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import ConsignmentModel from "../../models/consignment.model";
import Earning from "../../models/earning.model";
import FareConfigModel from "../../models/fareconfig.model";
import Payment from "../../models/payment.model";
import { Payout, type PayoutDoc } from "../../models/payout.model";
import PayoutAccountsModel from "../../models/payoutaccounts.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { User } from "../../models/user.model";
import { emitPaymentFailed, emitPaymentSuccess } from "../../socket/events";
import { notifyUser } from "../../lib/pushNotification";
const normalizePhoneNumber = (phone: string): string => {
  // Remove all spaces and dashes
  let normalized = phone.replace(/[\s-]/g, "");

  // If it starts with +91, keep it
  if (normalized.startsWith("+91")) {
    return normalized;
  }

  // If it starts with 91 (without +), add +
  if (normalized.startsWith("91") && normalized.length === 12) {
    return "+" + normalized;
  }

  // If it's 10 digits, add +91
  if (normalized.length === 10) {
    return "+91" + normalized;
  }

  return normalized;
};

// export const initiatePayment = async (req: AuthRequest, res: Response) => {
//   const session = await mongoose.startSession();

//   try {
//     const { carryRequestId } = req.body;
//     if (!carryRequestId) throw new Error("carryRequestId is required");

//     const carryRequest = await CarryRequest.findById(carryRequestId);
//     if (!carryRequest)
//       return res.status(404).json({ message: "Carry request not found" });

//     if (carryRequest.status !== "accepted_pending_payment") {
//       return res.status(400).json({
//         message:
//           "Carry request must be accepted before payment can be initiated",
//       });
//     }

//     const existingPayment = await Payment.findOne({
//       consignmentId: carryRequest.consignmentId,
//       status: "pending",
//     });
//     if (existingPayment) {
//       return res.status(400).json({ message: "Payment already initiated" });
//     }

//     // Create Razorpay order FIRST (before transaction)
//     const orderResponse = await axios.post(
//       "https://api.razorpay.com/v1/orders",
//       {
//         amount: carryRequest.senderPayAmount * 100,
//         currency: "INR",
//         receipt: carryRequest._id.toString(),
//         payment_capture: 1,
//       },
//       {
//         auth: {
//           username: env.RAZORPAY_KEY_ID,
//           password: env.RAZORPAY_KEY_SECRET,
//         },
//       }
//     );

//     session.startTransaction();

//     // console.log("ORDER RESPONSE FROM INITIATE PAYMENT => ", orderResponse);

//     //  Handle the array destructuring properly
//     const createdPayments = await Payment.create(
//       [
//         {
//           consignmentId: carryRequest.consignmentId,
//           travelId: carryRequest.travelId,
//           userId: carryRequest.requestedBy,
//           type: "sender_pay",
//           amount: carryRequest.senderPayAmount,
//           status: "pending",
//           razorpayOrderId: orderResponse.data.id,
//         },
//       ],
//       { session }
//     );

//     const paymentDoc = createdPayments[0];
//     if (!paymentDoc) {
//       throw new Error("Failed to create payment record");
//     }

//     await session.commitTransaction();

//     return res.status(200).json({
//       message: "Payment initiated",
//       order: orderResponse.data,
//       paymentId: paymentDoc._id,
//     });
//   } catch (error: any) {
//     await session.abortTransaction();
//     logger.error("Initiate payment error:", error);
//     return res
//       .status(500)
//       .json({ message: error.message || "Failed to initiate payment" });
//   } finally {
//     session.endSession();
//   }
// };

// export const initiatePayment = async (req: AuthRequest, res: Response) => {
//   const session = await mongoose.startSession();

//   try {
//     const { carryRequestId } = req.body;
//     if (!carryRequestId) throw new Error("carryRequestId is required");

//     const carryRequest = await CarryRequest.findById(carryRequestId);
//     if (!carryRequest)
//       return res.status(404).json({ message: "Carry request not found" });

//     if (carryRequest.status !== "accepted_pending_payment") {
//       return res.status(400).json({
//         message:
//           "Carry request must be accepted before payment can be initiated",
//       });
//     }

//     const now = new Date();

//     // Check for existing payment for THIS specific carry request
//     const existingPayment = await Payment.findOne({
//       carryRequestId: carryRequestId,
//       status: { $in: ["pending", "completed_pending_webhook"] },
//     });

//     if (existingPayment) {
//       // check is payment is still within validity period
//       if (existingPayment.expiresAt > now) {
//         // order is still valid -> check if it has at least 2 minutes left
//         const timeRemaining =
//           existingPayment.expiresAt.getTime() - now.getTime();
//         const twoMinutesInMs = 2 * 60 * 1000;

//         if (timeRemaining > twoMinutesInMs) {
//           // suffcieint time remianing - resuae existing order
//           logger.info(
//             `✅ Reusing existing payment order for carry request: ${carryRequestId}`
//           );

//           return res.status(200).json({
//             message: "Resuming your previous payment",
//             order: {
//               id: existingPayment.razorpayOrderId,
//               amount: existingPayment.amount * 100,
//               currency: "INR",
//             },
//             paymentId: existingPayment._id,
//             isRetry: true,
//           });
//         } else {
//           // Less than 2 minutes remaining - cancel and create new order
//           logger.info(
//             `⏰ Existing order expiring soon, creating new order for: ${carryRequestId}`
//           );

//           session.startTransaction();
//           existingPayment.status = "cancelled";
//           await existingPayment.save({ session });
//           await session.commitTransaction();
//         }
//       } else {
//         // Order has expired - cancel it
//         logger.info(
//           `❌ Existing payment order expired for carry request: ${carryRequestId}`
//         );

//         session.startTransaction();
//         existingPayment.status = "cancelled";
//         await existingPayment.save({ session });
//         await session.commitTransaction();
//       }
//     }

//     // ✅ Additional safety check: Ensure no completed payment exists for this consignment
//     // (This prevents edge case where multiple travellers were accepted simultaneously)
//     const completedPayment = await Payment.findOne({
//       consignmentId: carryRequest.consignmentId,
//       status: { $in: ["completed", "completed_pending_webhook"] },
//       type: "sender_pay",
//     });

//     if (completedPayment) {
//       logger.error(
//         `❌ Payment already completed for consignment: ${carryRequest.consignmentId}`
//       );
//       return res.status(400).json({
//         message:
//           "This consignment has already been paid for by another request",
//       });
//     }

//     // ✅ Create new Razorpay order
//     logger.info(`💳 Creating new Razorpay order for: ${carryRequestId}`);

//     // // Create Razorpay order FIRST (before transaction)
//     // const orderResponse = await axios.post(
//     //   "https://api.razorpay.com/v1/orders",
//     //   {
//     //     amount: carryRequest.senderPayAmount * 100,
//     //     currency: "INR",
//     //     receipt: `CR_${carryRequest._id.toString()}_${Date.now()}`, // Unique receipt
//     //     payment_capture: 1,
//     //     // notes: {
//     //     //   carryRequestId: carryRequest._id.toString(),
//     //     //   consignmentId: carryRequest.consignmentId.toString(),
//     //     //   travelId: carryRequest.travelId.toString(),
//     //     // },
//     //   },
//     //   {
//     //     auth: {
//     //       username: env.RAZORPAY_KEY_ID,
//     //       password: env.RAZORPAY_KEY_SECRET,
//     //     },
//     //   }
//     // );
//     let orderResponse;

//     try {
//       // 🧾 Step 1: Create Razorpay order
//       orderResponse = await axios.post(
//         "https://api.razorpay.com/v1/orders",
//         {
//           amount: carryRequest.senderPayAmount * 100, // Amount in paise
//           currency: "INR",
//           receipt: carryRequest._id.toString(), // Unique receipt
//           payment_capture: 1,
//           // notes: {
//           //   carryRequestId: carryRequest._id.toString(),
//           //   consignmentId: carryRequest.consignmentId.toString(),
//           //   travelId: carryRequest.travelId.toString(),
//           // },
//         },
//         {
//           auth: {
//             username: env.RAZORPAY_KEY_ID,
//             password: env.RAZORPAY_KEY_SECRET,
//           },
//           timeout: 10000, // optional: helps avoid hanging requests
//         }
//       );

//       const orderData = orderResponse.data;

//       logger.info(
//         "✅ Razorpay order created successfully:" +
//           {
//             orderId: orderData.id,
//             amount: orderData.amount,
//             currency: orderData.currency,
//           }
//       );

//       return orderData;
//     } catch (error: any) {
//       const errMsg =
//         error.response?.data?.error?.description ||
//         error.response?.data?.message ||
//         error.message ||
//         "Failed to create Razorpay order";

//       logger.error(
//         "❌ Error creating Razorpay order:" +
//           JSON.stringify(
//             error.response?.data || error.message || error,
//             null,
//             2
//           )
//       );
//     }

//     logger.info("We reached here after axios call...");

//     session.startTransaction();

//     // console.log("ORDER RESPONSE FROM INITIATE PAYMENT => ", orderResponse);

//     logger.info("transaction started...");

//     // Calculate expiry time (15 minutes from now - matches Razorpay default)
//     const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

//     logger.info("before payment creation...");

//     //  Handle the array destructuring properly
//     const createdPayments = await Payment.create(
//       [
//         {
//           consignmentId: carryRequest.consignmentId,
//           travelId: carryRequest.travelId,
//           userId: carryRequest.requestedBy,
//           carryRequestId: carryRequest._id, // ✅ Link to specific carry request
//           type: "sender_pay",
//           amount: carryRequest.senderPayAmount,
//           status: "pending",
//           razorpayOrderId: orderResponse?.data.id,
//           expiresAt,
//         },
//       ],
//       { session }
//     );

//     logger.info("after payment creation...");

//     const paymentDoc = createdPayments[0];
//     if (!paymentDoc) {
//       throw new Error("Failed to create payment record");
//     }

//     await session.commitTransaction();

//     logger.info(
//       `✅ Payment initiated successfully for carry request: ${carryRequestId}`
//     );

//     return res.status(200).json({
//       message: "Payment initiated successfully",
//       order: orderResponse?.data,
//       paymentId: paymentDoc._id,
//       isRetry: false,
//     });
//   } catch (error: any) {
//     await session.abortTransaction();
//     logger.error("❌ Initiate payment error:", error);

//     // ✅ Better error handling for common scenarios
//     if (error.response?.data) {
//       // Razorpay API error
//       return res.status(500).json({
//         message: "Payment gateway error. Please try again.",
//         error: error.response.data.error?.description || "Unknown error",
//       });
//     }

//     return res.status(500).json({
//       message: error.message || "Failed to initiate payment",
//     });
//   } finally {
//     session.endSession();
//   }
// };

export const initiatePayment = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const { carryRequestId } = req.body;
    if (!carryRequestId) throw new Error("carryRequestId is required");

    const carryRequest = await CarryRequest.findById(carryRequestId);
    if (!carryRequest)
      return res.status(404).json({ message: "Carry request not found" });

    if (carryRequest.status !== "accepted_pending_payment") {
      return res.status(400).json({
        message:
          "Carry request must be accepted before payment can be initiated",
      });
    }

    const now = new Date();

    // Check for existing payment
    const existingPayment = await Payment.findOne({
      carryRequestId: carryRequestId,
      status: { $in: ["pending", "completed_pending_webhook"] },
    });

    if (existingPayment) {
      if (existingPayment.expiresAt > now) {
        const timeRemaining =
          existingPayment.expiresAt.getTime() - now.getTime();
        const twoMinutesInMs = 2 * 60 * 1000;

        if (timeRemaining > twoMinutesInMs) {
          logger.info(
            `✅ Reusing existing payment order for carry request: ${carryRequestId}`,
          );
          return res.status(200).json({
            message: "Resuming your previous payment",
            order: {
              id: existingPayment.razorpayOrderId,
              amount: existingPayment.amount * 100,
              currency: "INR",
            },
            paymentId: existingPayment._id,
            isRetry: true,
          });
        } else {
          session.startTransaction();
          existingPayment.status = "cancelled";
          await existingPayment.save({ session });
          await session.commitTransaction();
        }
      } else {
        session.startTransaction();
        existingPayment.status = "cancelled";
        await existingPayment.save({ session });
        await session.commitTransaction();
      }
    }

    // Safety check for completed payment
    const completedPayment = await Payment.findOne({
      consignmentId: carryRequest.consignmentId,
      status: { $in: ["completed", "completed_pending_webhook"] },
      type: "sender_pay",
    });

    if (completedPayment) {
      return res.status(400).json({
        message:
          "This consignment has already been paid for by another request",
      });
    }

    let razorpayOrderId = `dev_order_${Date.now()}`;
    let orderData = {
      id: razorpayOrderId,
      amount: carryRequest.senderPayAmount * 100,
      currency: "INR",
    };

    const orderResponse = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: carryRequest.senderPayAmount * 100,
        currency: "INR",
        receipt: carryRequest._id.toString(),
        payment_capture: 1,
      },
      {
        auth: {
          username: env.RAZORPAY_KEY_ID,
          password: env.RAZORPAY_KEY_SECRET,
        },
        timeout: 10000,
      },
    );
    razorpayOrderId = orderResponse.data.id;
    orderData = orderResponse.data;
    logger.info(`✅ Razorpay order created: ${razorpayOrderId}`);
    // ✅ NOW start transaction and save to DB
    session.startTransaction();

    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const createdPayments = await Payment.create(
      [
        {
          consignmentId: carryRequest.consignmentId,
          travelId: carryRequest.travelId,
          userId: carryRequest.requestedBy,
          carryRequestId: carryRequest._id,
          type: "sender_pay",
          amount: carryRequest.senderPayAmount,
          status: "pending",
          razorpayOrderId: razorpayOrderId, // ✅ Correctly saved now
          expiresAt,
        },
      ],
      { session },
    );

    const paymentDoc = createdPayments[0];
    if (!paymentDoc) throw new Error("Failed to create payment record");

    await session.commitTransaction();

    logger.info(
      `✅ Payment initiated successfully for carry request: ${carryRequestId}`,
    );

    return res.status(200).json({
      message: "Payment initiated successfully",
      order: orderData,
      paymentId: paymentDoc._id,
      isRetry: false,
    });
  } catch (error: any) {
    await session.abortTransaction();
    logger.error("❌ Initiate payment error:", error);

    if (error.response?.data) {
      return res.status(500).json({
        message: "Payment gateway error. Please try again.",
        error: error.response.data.error?.description || "Unknown error",
      });
    }

    return res.status(500).json({
      message: error.message || "Failed to initiate payment",
    });
  } finally {
    session.endSession();
  }
};

// export const capturePayment = async (req: AuthRequest, res: Response) => {
//   const session = await mongoose.startSession();

//   try {
//     const { paymentId, razorpayPaymentId, razorpaySignature } = req.body;

//     const payment = await Payment.findById(paymentId);
//     if (!payment) return res.status(404).json({ message: "Payment not found" });

//     // Check if payment was cancelled (user abandoned it)
//     if (payment.status === "cancelled") {
//       return res.status(400).json({
//         message: "This payment was cancelled. Please initiate a new payment.",
//       });
//     }

//     // ✅ CRITICAL: If webhook already processed it, just return success
//     // This prevents overwriting the "completed" status from webhook
//     if (payment.status === "completed") {
//       logger.info(`✅ Payment already completed by webhook: ${paymentId}`);
//       return res.status(200).json({
//         message: "Payment already completed",
//         paymentId: payment._id,
//         status: "completed",
//       });
//     }

//     // Also check if it's already pending webhook (prevent duplicate processing)
//     if (
//       payment.status === "completed_pending_webhook" &&
//       payment.razorpayPaymentId === razorpayPaymentId
//     ) {
//       logger.info(
//         `✅ Payment already verified, awaiting webhook: ${paymentId}`
//       );
//       return res.status(200).json({
//         message: "Payment already verified, awaiting webhook",
//         paymentId: payment._id,
//         status: "completed_pending_webhook",
//       });
//     }

//     // Check if payment has expired
//     if (payment.expiresAt < new Date()) {
//       session.startTransaction();
//       payment.status = "cancelled";
//       await payment.save({ session });
//       await session.commitTransaction();

//       return res.status(400).json({
//         message: "Payment order has expired. Please initiate a new payment.",
//       });
//     }

//     const generatedSignature = crypto
//       .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
//       .update(`${payment.razorpayOrderId}|${razorpayPaymentId}`)
//       .digest("hex");

//     if (generatedSignature !== razorpaySignature) {
//       return res
//         .status(400)
//         .json({ message: "Payment signature verification failed" });
//     }

//     session.startTransaction();

//     // ✅ Only update if not already completed
//     if (payment.status !== ("completed" as Payment["status"])) {
//       payment.status = "completed_pending_webhook";
//       payment.razorpayPaymentId = razorpayPaymentId;
//       await payment.save({ session });

//       logger.info(
//         `✅ Payment verified, status: completed_pending_webhook, awaiting webhook: ${paymentId}`
//       );
//     }

//     await session.commitTransaction();

//     return res.status(200).json({
//       message: "Payment verified, awaiting confirmation from Razorpay webhook",
//       paymentId: payment._id,
//     });
//   } catch (error: any) {
//     await session.abortTransaction();
//     logger.error("Capture payment error:", error);
//     return res
//       .status(500)
//       .json({ message: error.message || "Failed to capture payment" });
//   } finally {
//     session.endSession();
//   }
// };

export const capturePayment = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const { paymentId, razorpayPaymentId, razorpaySignature } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    // Check if payment was cancelled (user abandoned it)
    if (payment.status === "cancelled") {
      return res.status(400).json({
        message: "This payment was cancelled. Please initiate a new payment.",
      });
    }

    // ✅ CRITICAL: If webhook already processed it, just return success
    // This prevents overwriting the "completed" status from webhook
    if (payment.status === "completed") {
      logger.info(`✅ Payment already completed by webhook: ${paymentId}`);
      return res.status(200).json({
        message: "Payment already completed",
        paymentId: payment._id,
        status: "completed",
      });
    }

    // Also check if it's already pending webhook (prevent duplicate processing)
    if (
      payment.status === "completed_pending_webhook" &&
      payment.razorpayPaymentId === razorpayPaymentId
    ) {
      logger.info(
        `✅ Payment already verified, awaiting webhook: ${paymentId}`,
      );
      return res.status(200).json({
        message: "Payment already verified, awaiting webhook",
        paymentId: payment._id,
        status: "completed_pending_webhook",
      });
    }

    // Check if payment has expired
    if (payment.expiresAt < new Date()) {
      session.startTransaction();
      payment.status = "cancelled";
      await payment.save({ session });
      await session.commitTransaction();

      return res.status(400).json({
        message: "Payment order has expired. Please initiate a new payment.",
      });
    }

    if (env.NODE_ENV !== "development") {
      const generatedSignature = crypto
        .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
        .update(`${payment.razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      logger.info("generatedSignature => " + generatedSignature);
      logger.info("razorpaySignature => " + razorpaySignature);

      if (generatedSignature !== razorpaySignature) {
        return res
          .status(400)
          .json({ message: "Payment signature verification failed" });
      }
    }

    session.startTransaction();

    // ✅ Only update if not already completed
    if (payment.status !== ("completed" as Payment["status"])) {
      payment.status = "completed_pending_webhook";
      payment.razorpayPaymentId = razorpayPaymentId;
      await payment.save({ session });

      logger.info(
        `✅ Payment verified, status: completed_pending_webhook, awaiting webhook: ${paymentId}`,
      );
    }

    await session.commitTransaction();

    return res.status(200).json({
      message: "Payment verified, awaiting confirmation from Razorpay webhook",
      paymentId: payment._id,
    });
  } catch (error: any) {
    await session.abortTransaction();
    logger.error("Capture payment error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to capture payment" });
  } finally {
    session.endSession();
  }
};

export const razorpayWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const body = JSON.stringify(req.body);

    if (env.NODE_ENV !== "development") {
      // verify webhook signature
      const expectedSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest("hex");

      if (signature !== expectedSignature) {
        logger.warn("❌ Razorpay webhook signature mismatch");
        return res.status(400).send("Invalid signature");
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    logger.info(`📩 Razorpay webhook received: ${event}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ------------ PAYMENT EVENTS -------------
      if (event.startsWith("payment.")) {
        const { id: razorpayPaymentId, order_id: razorpayOrderId } =
          payload.payment.entity;

        //find payment in payment model
        const payment = await Payment.findOne({ razorpayOrderId }).session(
          session,
        );
        if (!payment) {
          logger.error(
            "Payment record not found for webhook order_id:",
            razorpayOrderId,
          );
          throw new Error("Payment record not found for webhook");
        }

        // Prevent duplicate processing, Idempotency check
        if (payment.status === "completed" && event === "payment.captured") {
          logger.info("Payment already completed, skipping webhook processing");
          await session.abortTransaction();
          return res.status(200).send("Payment already processed");
        }

        if (event === "payment.captured") {
          logger.info(
            `🎯 Processing payment.captured webhook for order: ${razorpayOrderId}`,
          );

          // ✅ Idempotency check: Skip if already completed
          if (payment.status === "completed") {
            logger.info(
              `✅ Payment already completed, skipping webhook processing: ${razorpayOrderId}`,
            );
            await session.abortTransaction();
            return res.status(200).send("Payment already processed");
          }

          // Update payment
          payment.status = "completed";
          payment.razorpayPaymentId = razorpayPaymentId;
          await payment.save({ session });

          logger.info(
            `✅ Payment status updated to COMPLETED: ${razorpayOrderId}`,
          );
          logger.info(`   Payment ID: ${payment._id}`);
          logger.info(`   Razorpay Payment ID: ${razorpayPaymentId}`);
          logger.info(`   Status in DB: ${payment.status}`);

          // Update CarryRequest
          // console.log("Updating CarryRequest...");
          const carryRequest = await CarryRequest.findOneAndUpdate(
            {
              consignmentId: payment.consignmentId,
              status: "accepted_pending_payment",
            },
            { status: "accepted" },
            { new: true, session },
          );
          if (!carryRequest) {
            logger.error("❌ CarryRequest not found or already processed");
            throw new Error("CarryRequest not found");
          }

          logger.info(`✅ CarryRequest updated to accepted`);

          // Auto-reject other carry requests
          await CarryRequest.updateMany(
            {
              consignmentId: payment.consignmentId,
              _id: { $ne: carryRequest._id }, // Not the accepted one
              status: { $in: ["pending", "accepted_pending_payment"] },
            },
            {
              status: "rejected",
              // rejectionReason: "Another traveller was selected", // Optional field
            },
            { session },
          );

          logger.info(`✅ Auto-rejected other carry requests for consignment`);

          // Update Consignment status to "assigned"
          // console.log("Updating Consignment status to 'assigned'...");
          const updatedConsignment = await ConsignmentModel.findOneAndUpdate(
            { _id: payment.consignmentId },
            {
              $set: {
                status: "assigned",
                travellerId: carryRequest.travellerId,
                assignedAt: new Date(),
              },
            },
            { new: true, session },
          );

          if (!updatedConsignment) {
            throw new Error("Failed to update consignment to 'assigned'");
          }

          logger.info(`✅ Consignment updated to assigned`);

          // // Calculate platform commission
          const fareConfig = await FareConfigModel.findOne()
            .sort({ createdAt: -1 })
            .lean();
          if (!fareConfig) throw new Error("Fare configuration not found");

          const { margin } = fareConfig; // percentage margin

          const platformCommission = Number(
            ((carryRequest.senderPayAmount * margin) / 100).toFixed(2),
          );

          // ✅ Better idempotency check: Check by consignment + travel combination
          const existingTravelConsignment = await TravelConsignments.findOne({
            consignmentId: payment.consignmentId,
            travelId: payment.travelId,
          }).session(session);
          // console.log("Done with searching existing TravelConsignment...");

          if (!existingTravelConsignment) {
            logger.info("🔍 Fetching consignment for OTP generation...");

            const consignment = await ConsignmentModel.findById(
              payment.consignmentId,
            )
              .select("receiverPhone receiverName senderId")
              .lean()
              .session(session);
            if (!consignment) throw new Error("consignment not found");

            logger.info("✅ Consignment found, fetching users...");

            // Fetch sender (the person who created the consignment)
            const sender = await User.findById(carryRequest.requestedBy)
              .select("phoneNumber firstName lastName")
              .lean()
              .session(session);

            // Fetch traveller (to ensure we NEVER send OTP to them)
            const traveller = await User.findById(carryRequest.travellerId)
              .select("phoneNumber firstName lastName")
              .lean()
              .session(session);

            if (!sender || !traveller) {
              throw new Error("Sender or traveller not found");
            }

            const receiver = consignment;

            if (!sender || !receiver)
              throw new Error("Sender or receiver not found");

            // Normalize all phone numbers
            const senderPhone = normalizePhoneNumber(sender.phoneNumber);
            const receiverPhone = normalizePhoneNumber(
              consignment.receiverPhone,
            );
            const travellerPhone = normalizePhoneNumber(traveller.phoneNumber);

            // 🚨 CRITICAL VALIDATION: Ensure traveller's phone is NEVER used for OTPs
            logger.info("📞 Phone Numbers Check:");
            logger.info(`   Sender: ${senderPhone}`);
            logger.info(`   Receiver: ${receiverPhone}`);
            logger.info(`   Traveller: ${travellerPhone}`);

            // Validation check
            if (receiverPhone === travellerPhone) {
              logger.error(
                "❌ CRITICAL ERROR: Receiver phone matches traveller phone!",
              );
              logger.error(
                "This should NEVER happen. The consignment data is corrupted.",
              );
              throw new Error(
                "Invalid consignment: receiver phone cannot be traveller's phone",
              );
            }

            if (senderPhone === travellerPhone) {
              logger.error(
                "❌ CRITICAL ERROR: Sender phone matches traveller phone!",
              );
              logger.error(
                "This indicates carryRequest.requestedBy is pointing to traveller instead of sender.",
              );
              throw new Error(
                "Invalid carry request: sender cannot be the traveller",
              );
            }

            // Log the relationship
            const samePersonSendingAndReceiving = senderPhone === receiverPhone;
            if (samePersonSendingAndReceiving) {
              logger.info(
                "📦 Same person is sender and receiver (self-delivery)",
              );
              logger.info("   Both OTPs will go to: " + senderPhone);
            } else {
              logger.info("📦 Different sender and receiver:");
              logger.info(
                `   Sender OTP → ${senderPhone} (${
                  sender.firstName || "Unknown"
                })`,
              );
              logger.info(
                `   Receiver OTP → ${receiverPhone} (${
                  consignment.receiverName || "Unknown"
                })`,
              );
            }

            logger.info("SENDER PHONE NUMBER => " + sender.phoneNumber);
            logger.info("RECEIVER PHONE NUMBER => " + receiver.receiverPhone);

            // Generate OTPs
            logger.info("🔐 Generating OTPs...");
            const [senderOTPObj, receiverOTPObj] = await Promise.all([
              generateOtp(senderPhone, "sender"),
              generateOtp(receiverPhone, "receiver"),
            ]);

            const senderOTP = senderOTPObj?.otp ?? "000000";
            const receiverOTP = receiverOTPObj?.otp ?? "000000";

            logger.info(`✅ OTPs Generated Successfully:`);
            logger.info(`   Sender OTP: ${senderOTP} → ${senderPhone}`);
            logger.info(`   Receiver OTP: ${receiverOTP} → ${receiverPhone}`);

            // Double-check before creating TravelConsignment
            logger.info("📝 Creating TravelConsignment record...");

            // console.log(
            //   "Inside !existingTravelConsignment, done searching for sender, created otps..."
            // );

            // console.log(
            //   "Inside !existingTravelConsignment, Creating TravelConsignment..."
            // );
            // Create TravelConsignment
            try {
              await TravelConsignments.create(
                [
                  {
                    travelId: payment.travelId,
                    consignmentId: payment.consignmentId,
                    senderOTP,
                    receiverOTP,
                    status: "to_handover",
                    travellerEarning: carryRequest.travellerEarning,
                    senderToPay: carryRequest.senderPayAmount,
                    platformCommission,
                    paymentId: payment._id,
                  },
                ],
                { session },
              );
            } catch (err) {
              console.error("❌ Failed to create TravelConsignment:", err);
              throw err;
            }
            // console.log(
            //   "Inside !existingTravelConsignment, done Creating TravelConsignment..."
            // );

            // console.log(
            //   "Inside !existingTravelConsignment, Creating traveller earning..."
            // );

            // Create traveller and platform commission earning
            try {
              await Earning.create(
                [
                  {
                    userId: carryRequest.travellerId,
                    travelId: payment.travelId,
                    consignmentId: payment.consignmentId,
                    amount: carryRequest.travellerEarning,
                    status: "pending",
                    is_withdrawn: false,
                  },
                ],
                { session },
              );
            } catch (error) {
              console.error("❌ Failed to create Earning record:", error);
            }

            // Create platform commission payment record
            try {
              // ✅ Create platform commission payment record
              await Payment.create(
                [
                  {
                    userId: null, // Platform has no userId
                    consignmentId: payment.consignmentId,
                    travelId: payment.travelId,
                    carryRequestId: payment.carryRequestId,
                    type: "platform_commission",
                    amount: platformCommission, // Commission
                    status: "completed", // Instantly completed when sender pays
                    razorpayOrderId: payment.razorpayOrderId, // Link to original order
                    razorpayPaymentId: razorpayPaymentId,
                  },
                ],
                { session },
              );
            } catch (error) {
              logger.error(
                "❌ Failed to create platform commission payment record:" +
                  error,
              );
            }
          }

          await emitPaymentSuccess(carryRequest.travellerId.toString(), {
            paymentId: payment._id.toString(),
            payerId: payment.userId,
            consignmentId: payment.consignmentId.toString(),
            travelId: payment.travelId.toString(),
            amount: payment.amount,
            status: "completed",
          });

          // Send push notifications
          await notifyUser(
            carryRequest.requestedBy,
            "Payment Successful",
            "Payment successful! The consignment is now officially assigned.",
          );
          await notifyUser(
            carryRequest.travellerId,
            "Consignment Assigned",
            "Payment successful! You are now officially assigned to carry the consignment.",
          );

          logger.info(
            `✅ Payment processed & commission recorded: ₹${platformCommission}`,
          );
          // logger.info(`✅ Payment processed from webhook`);

          // Notify both sender and traveller about CarryRequest update
          // await emitCarryRequestUpdate(carryRequest.travellerId.toString(), {
          //   requestId: carryRequest._id.toString(),
          //   consignmentId: carryRequest.consignmentId.toString(),
          //   travellerId: carryRequest.travellerId.toString(),
          //   status: "accepted",
          // });

          // await emitCarryRequestUpdate(carryRequest.requestedBy.toString(), {
          //   requestId: carryRequest._id.toString(),
          //   consignmentId: carryRequest.consignmentId.toString(),
          //   travellerId: carryRequest.travellerId.toString(),
          //   status: "accepted",
          // });

          logger.info(`✅ Payment completed and processed: ${razorpayOrderId}`);
        } else if (event === "payment.failed") {
          const {
            order_id: razorpayOrderId,
            id: razorpayPaymentId,
            error_code,
            error_description,
          } = payload.payment.entity;

          logger.info("Webhook order_id:", razorpayOrderId);
          logger.info("Looking for payment in DB...");

          const payment = await Payment.findOne({ razorpayOrderId }).session(
            session,
          );
          if (!payment)
            throw new Error("Payment record not found for failed webhook");
          console.log("Found payment:", payment);

          payment.status = "failed";
          payment.razorpayPaymentId = razorpayPaymentId;
          await payment.save({ session });

          // Emit failed event
          const carryRequest = await CarryRequest.findOne({
            consignmentId: payment.consignmentId,
          });
          if (carryRequest) {
            await emitPaymentFailed(carryRequest.requestedBy.toString(), {
              paymentId: payment._id.toString(),
              payerId: payment.userId.toString(),
              consignmentId: payment.consignmentId.toString(),
              travelId: payment.travelId.toString(),
              amount: payment.amount,
              status: "failed",
            });
          }

          logger.warn(`⚠️ Payment failed for order ${razorpayOrderId}`);
        }
      }
      // Removed refund events handling since refund is manual now

      await session.commitTransaction();
      return res.status(200).send("Webhook processed successfully");
    } catch (err: any) {
      await session.abortTransaction();
      logger.error("Webhook processing error:", err);
      res.status(500).send("Webhook processing failed");
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error("Error handling Razorpay webhook:", error);
    res.status(500).send("Internal server error");
  }
};
