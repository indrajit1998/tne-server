import axios from "axios";
import crypto from "crypto";
import type { Response } from "express";
import mongoose from "mongoose";
import env from "../../lib/env";
import logger from "../../lib/logger";
import { generateOtp } from "../../lib/utils";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import { CarryRequest } from "../../models/carryRequest.model";
import ConsignmentModel from "../../models/consignment.model";
import Earning from "../../models/earning.model";
import Payment from "../../models/payment.model";
import TravelConsignments from "../../models/travelconsignments.model";
import { User } from "../../models/user.model";
import { emitPaymentFailed, emitPaymentSuccess } from "../../socket/events";

export const initiatePayment = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const { carryRequestId } = req.body;
    if (!carryRequestId) throw new Error("carryRequestId is required");

    const carryRequest = await CarryRequest.findById(carryRequestId);
    if (!carryRequest)
      return res.status(404).json({ message: "Carry request not found" });

    const travelConsignment = await TravelConsignments.findOne({
      consignmentId: carryRequest.consignmentId,
      travellerId: carryRequest.travellerId,
      status: "accepted",
    });

    if (!travelConsignment) {
      return res
        .status(404)
        .json({ message: "Travel for this carry request not found" });
    }

    const existingPayment = await Payment.findOne({
      consignmentId: carryRequest.consignmentId,
      status: "pending",
    });
    if (existingPayment) {
      return res.status(400).json({ message: "Payment already initiated" });
    }

    session.startTransaction(); // Starting transaction here

    // Create Payment record in pending state
    const [paymentDoc] = await Payment.create(
      [
        {
          consignmentId: carryRequest.consignmentId,
          travelId: travelConsignment.travelId,
          userId: carryRequest.requestedBy, // sender
          type: "sender_pay",
          amount: carryRequest.senderPayAmount,
          status: "pending",
          carryRequestId: carryRequest._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Create Razorpay order
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
      }
    );

    if (!paymentDoc) {
      throw new Error("Failed to create payment record");
    }

    paymentDoc.razorpayOrderId = orderResponse.data.id;
    await paymentDoc.save();

    return res.status(200).json({
      message: "Payment initiated",
      order: orderResponse.data,
      paymentId: paymentDoc._id,
    });
  } catch (error: any) {
    await session.abortTransaction();
    logger.error("Initiate payment error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to initiate payment" });
  } finally {
    session.endSession();
  }
};

export const capturePayment = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { paymentId, razorpayPaymentId, razorpaySignature } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const generatedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${payment.razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res
        .status(400)
        .json({ message: "Payment signature verification failed" });
    }

    session.startTransaction();

    payment.status = "completed";
    payment.razorpayPaymentId = razorpayPaymentId;
    await payment.save({ session });

    // Optionally, update CarryRequest status to 'accepted' after successful payment
    const carryRequest = await CarryRequest.findOne({
      consignmentId: payment.consignmentId,
      status: "accepted_pending_payment",
    }).session(session);

    if (carryRequest) {
      carryRequest.status = "accepted";
      await carryRequest.save({ session });
    }

    await session.commitTransaction();

    // --- EMIT SOCKET EVENTS AFTER COMMIT ---
    // if (carryRequest) {
    //   // Notify traveller
    //   await emitPaymentSuccess(carryRequest.travellerId.toString(), {
    //     paymentId: payment._id.toString(),
    //     consignmentId: payment.consignmentId.toString(),
    //     travelId: payment.travelId.toString(),
    //     amount: payment.amount,
    //     status: "completed",
    //   });

    //   // Optional: Notify sender & traveller about carryRequest update
    //   await emitCarryRequestUpdate(carryRequest.travellerId.toString(), {
    //     requestId: carryRequest._id.toString(),
    //     consignmentId: carryRequest.consignmentId.toString(),
    //     travellerId: carryRequest.travellerId.toString(),
    //     status: "accepted",
    //   });

    //   await emitCarryRequestUpdate(carryRequest.requestedBy.toString(), {
    //     requestId: carryRequest._id.toString(),
    //     consignmentId: carryRequest.consignmentId.toString(),
    //     travellerId: carryRequest.travellerId.toString(),
    //     status: "accepted",
    //   });
    // }

    return res.status(200).json({ message: "Payment verified and completed" });
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

    // verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      logger.warn("Razorpay webhook signature mismatch");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;
    const payload = req.body.payload;

    logger.info(`Razorpay webhook received: ${event}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (event === "payment.captured") {
        const { id: razorpayPaymentId, order_id: razorpayOrderId } =
          payload.payment.entity;

        //update payment model
        const payment = await Payment.findOne({ razorpayOrderId }).session(
          session
        );
        if (!payment) {
          logger.error(
            "Payment record not found for webhook order_id:",
            razorpayOrderId
          );
          throw new Error("Payment record not found for webhook");
        }

        // Prevent duplicate processing, Idempotency check
        if (payment.status === "completed") {
          logger.info("Payment already completed, skipping webhook processing");
          await session.abortTransaction();
          return res.status(200).send("Payment already processed");
        }

        // Update payment
        payment.status = "completed";
        payment.razorpayPaymentId = razorpayPaymentId;
        await payment.save({ session });

        // Update CarryRequest
        const carryRequest = await CarryRequest.findOneAndUpdate(
          {
            consignmentId: payment.consignmentId,
            status: "accepted_pending_payment",
          },
          { status: "accepted" },
          { new: true, session }
        );
        if (!carryRequest) throw new Error("CarryRequest not found");

        // Create TravelConsignment if not exists
        const existingTravelConsignment = await TravelConsignments.findOne({
          paymentId: payment._id,
        }).session(session);

        if (!existingTravelConsignment) {
          const consignment = await ConsignmentModel.findById(
            payment.consignmentId
          )
            .select("receiverPhone receiverName")
            .lean()
            .session(session);
          if (!consignment) throw new Error("consignment not found");

          const sender = await User.findById(carryRequest.requestedBy).session(
            session
          );
          const receiver = consignment;

          if (!sender || !receiver)
            throw new Error("Sender or receiver not found");

          // Generate OTPs now
          const [senderOTP, receiverOTP] = await Promise.all([
            generateOtp(sender.phoneNumber, "sender"),
            generateOtp(receiver.receiverPhone, "receiver"),
          ]);

          // Create TravelConsignment
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
                paymentId: payment._id,
              },
            ],
            { session }
          );

          // Create traveller earning
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
            { session }
          );
        }

        // TODO: Platform commission logic

        await session.commitTransaction();

        // Update CarryRequest status
        // await CarryRequest.findByIdAndUpdate(payment.consignmentId, {
        //   status: "accepted",
        // }).session(session);

        // TODO: Emit socket events
        await emitPaymentSuccess(carryRequest.travellerId.toString(), {
          paymentId: payment._id.toString(),
          payerId: payment.userId, //TODO: CHEECK IF CORRECT OR NOT
          consignmentId: payment.consignmentId.toString(),
          travelId: payment.travelId.toString(),
          amount: payment.amount,
          status: "completed",
        });

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

        // TODO: platform commission

        logger.info(`Payment completed for order ${razorpayOrderId}`);
      } else if (event === "payment.failed") {
        const {
          order_id: razorpayOrderId,
          id: razorpayPaymentId,
          error_code,
          error_description,
        } = payload.payment.entity;

        const payment = await Payment.findOne({ razorpayOrderId }).session(
          session
        );
        if (!payment)
          throw new Error("Payment record not found for failed webhook");

        payment.status = "failed";
        payment.razorpayPaymentId = razorpayPaymentId;
        await payment.save({ session });

        await session.commitTransaction();

        // TODO: Emit socket event to FE
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

        logger.warn(`Payment failed for order ${razorpayOrderId}`);
      }

      res.status(200).send("Webhook received");
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
