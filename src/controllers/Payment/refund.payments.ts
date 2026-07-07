// import type { Response } from "express";
// import crypto from "crypto";
// import mongoose from "mongoose";
// import axios from "axios";
// import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
// import env from "../../lib/env";
// import Payment from "../../models/payment.model";
// import ConsignmentModel from "../../models/consignment.model";
// import logger from "../../lib/logger";
// export const razorpayRefundWebhook = async (req: AdminAuthRequest, res: Response) => {
//   try {
//     const signature = req.headers["x-razorpay-signature"] as string;
//     const body = JSON.stringify(req.body);

//     // ✅ Verify webhook signature
//     const expectedSignature = crypto
//       .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
//       .update(body)
//       .digest("hex");

//     if (signature !== expectedSignature) {
//       logger.warn("❌ Refund webhook signature mismatch");
//       return res.status(400).send("Invalid signature");
//     }

//     const event = req.body.event;
//     const refundEntity = req.body.payload?.refund?.entity;
//     if (!refundEntity) {
//       logger.warn("⚠️ Missing refund entity in webhook payload");
//       return res.status(400).send("Missing refund data");
//     }

//     const { id: refundId, payment_id, amount, status, speed } = refundEntity;

//     logger.info(`📩 Razorpay Refund Event: ${event} → ${refundId}`);

//     // start session for atomic operations
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       // Find related payment
//       const payment = await Payment.findOne({
//         razorpayPaymentId: payment_id,
//       }).session(session);

//       if (!payment) {
//         logger.error(`❌ Payment not found for refund webhook: ${payment_id}`);
//         await session.abortTransaction();
//         return res.status(404).send("Payment not found for refund webhook");
//       }

//       // Switch-case style handling
//       switch (event) {
//         case "refund.created":
//           payment.refundDetails = {
//             refundId,
//             amount,
//             speed,
//             status: "created",
//           };
//           await payment.save({ session });
//           logger.info(`🟡 Refund created for Payment ${payment_id}`);
//           break;

//         case "refund.processed":
//           payment.refundDetails = {
//             refundId,
//             amount,
//             speed,
//             status: "processed",
//           };
//           payment.status = "refunded";
//           await payment.save({ session });
//           logger.info(`✅ Refund processed for Payment ${payment_id}`);
//           break;

//         case "refund.failed":
//           payment.refundDetails = {
//             refundId,
//             amount,
//             speed,
//             status: "failed",
//           };
//           await payment.save({ session });
//           logger.warn(`⚠️ Refund failed for Payment ${payment_id}`);
//           break;

//         default:
//           logger.info(`Unhandled refund event: ${event}`);
//       }

//       await session.commitTransaction();
//       return res.status(200).send("Refund webhook processed successfully");
//     } catch (err: any) {
//       await session.abortTransaction();
//       logger.error("Refund webhook error:", err);
//       return res.status(500).send("Refund webhook processing failed");
//     } finally {
//       session.endSession();
//     }
//   } catch (error: any) {
//     logger.error("Error in Razorpay refund webhook:", error);
//     return res.status(500).send("Internal server error");
//   }
// };

// /**
//  * @desc Initiate a refund for a specific consignment
//  */
// export const initiateRefund = async (req: AdminAuthRequest, res: Response) => {
//   const { consignmentId } = req.params;
//   const { amount } = req.body;

//   try {
//     // 1️⃣ Validate consignment existence
//     const consignment = await ConsignmentModel.findById(consignmentId);
//     if (!consignment) {
//       return res.status(404).json({ message: "Consignment not found" });
//     }

//     // 2️⃣ Find the corresponding payment
//     const payment = await Payment.findOne({ consignmentId });
//     if (!payment) {
//       return res.status(404).json({ message: "Payment record not found" });
//     }

//     // 3️⃣ Check payment status
//     if (payment.status === "refunded") {
//         return res.status(400).json({ message: "This payment has already been refunded" });
//     }

//     if (payment.status !== "completed") {
//       return res.status(400).json({ message: "Refund not allowed. Payment not completed." });
//     }
//     const amountPaise = Math.floor(Number(amount));
//     console.log("Refund Debug → Amount :", amount);
//     console.log("Refund Debug → Amount paise:", amountPaise);
//     if (isNaN(amountPaise) || amountPaise <= 0) {
//         return res.status(400).json({ message: "Invalid refund amount" });
//     }

//     console.log("Refund Debug → Payment ID:","pay_RWWOopqVYixqnW");// payment.razorpayPaymentId);
//     console.log("Refund Debug → Consignment ID:", consignmentId);
//     // 4️⃣ Initiate Razorpay refund API call
//     const refundResponse = await axios.post(
//       `https://api.razorpay.com/v1/payments/${payment.razorpayPaymentId}/refund`,
//       //used for testing
//       // `https://api.razorpay.com/v1/payments/pay_RWWOopqVYixqnW/refund`,
//       { amount:amountPaise }, // amount in paise
//       {
//         auth: {
//           username: env.RAZORPAY_KEY_ID,
//           password: env.RAZORPAY_KEY_SECRET,
//         },
//       }
//     );
//     if (refundResponse.status !== 200 ) {
//       logger.error("❌ Razorpay refund API error:", refundResponse.data);
//       return res.status(500).json({ message: "Razorpay refund initiation failed" });
//     }

//     // 5️⃣ Update payment document with refund details
//     payment.status = "refunded";
//     payment.refundDetails = {
//       refundId: refundResponse.data.id,
//       amount: refundResponse.data.amount,
//       speed: refundResponse.data.speed,
//       status: refundResponse.data.status,
//     };
//     await payment.save();

//     logger.info(`Refund initiated for Payment ID: ${payment.razorpayPaymentId}`);

//     // 6️⃣ Respond to frontend
//     return res.status(200).json({
//       message: "Refund initiated successfully",
//       refund: refundResponse.data,
//     });
//   } catch (error: any) {
//   const errData = error.response?.data || error.message;
//   logger.error("Refund initiation error details:", errData);
//   console.log("Refund initiation error details:", error);
//   return res.status(500).json({
//     message: "Refund initiation failed",
//     error: errData,
//   });
// }
// };

import type { Response } from "express";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import Payment from "../../models/payment.model";
import ConsignmentModel from "../../models/consignment.model";
import { Refund } from "../../models/refund.model";
import logger from "../../lib/logger";
import { notifyUser } from "../../lib/pushNotification";

/**
 * 💸 Initiate a Refund for a Specific Consignment
 */
export const initiateRefund = async (req: AdminAuthRequest, res: Response) => {
  const { consignmentId } = req.params;
  const { amount } = req.body;

  try {
    // 1️⃣ Validate consignment existence
    const consignment = await ConsignmentModel.findById(consignmentId);
    if (!consignment) {
      return res.status(404).json({ message: "Consignment not found" });
    }

    // 2️⃣ Find the corresponding payment
    const payment = await Payment.findOne({ consignmentId });
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // 3️⃣ Validate payment status
    if (payment.status === "refunded") {
      return res
        .status(400)
        .json({ message: "This payment has already been refunded" });
    }

    if (payment.status !== "completed") {
      return res
        .status(400)
        .json({ message: "Refund not allowed. Payment not completed." });
    }

    // 4️⃣ Validate and convert refund amount
    const refundAmountRupees = Number(amount) / 100;
    if (isNaN(refundAmountRupees) || refundAmountRupees <= 0) {
      return res.status(400).json({ message: "Invalid refund amount" });
    }

    const refundAmountPaise = amount;

    console.log("Refund Debug → Amount (₹):", refundAmountRupees);
    console.log("Refund Debug → Amount (paise):", refundAmountPaise);
    console.log("Refund Debug → Payment ID:", payment.razorpayPaymentId);
    console.log("Refund Debug → Consignment ID:", consignmentId);

    // 5️⃣ Manual Refund Processing (Bypassing Razorpay API)
    logger.info(
      `🟢 Initiating manual refund for Payment ID: ${payment.razorpayPaymentId}`,
    );

    const manualRefundId = `rfnd_manual_${Date.now()}`;

    // Create a Refund record
    const refundRecord = new Refund({
      userId: consignment.senderId,
      paymentId: payment._id,
      consignmentId: consignment._id,
      amount: refundAmountRupees,
      status: "pending",
      refundId: manualRefundId,
    });
    await refundRecord.save();

    // Mark payment as refund_pending instead of refunded
    payment.status = "refund_pending";
    payment.refundDetails = {
      refundId: manualRefundId,
      amount: refundAmountRupees,
      speed: "manual",
      status: "pending",
    };
    await payment.save();

    logger.info(
      `Refund initiated manually for Payment ID: ${payment.razorpayPaymentId}`,
    );

    // Notify sender about the refund initiation
    await notifyUser(
      consignment.senderId,
      "Refund Initiated",
      `A refund of ₹${refundAmountRupees} has been initiated and is pending admin approval.`,
    );

    // 6️⃣ Respond to frontend
    return res.status(200).json({
      message: "Refund request created successfully",
      refund: {
        id: manualRefundId,
        amount: refundAmountRupees,
        status: "pending",
        speed: "manual",
      },
    });
  } catch (error: any) {
    const errData = error.response?.data || error.message;
    logger.error("Refund initiation error details:", errData);
    console.log("Refund initiation error details:", error);
    return res.status(500).json({
      message: "Refund initiation failed",
      error: errData,
    });
  }
};
