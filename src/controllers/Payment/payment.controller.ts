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
import FareConfigModel from "../../models/fareconfig.model";
import Payment from "../../models/payment.model";
import { Payout, type PayoutDoc } from "../../models/payout.model";
import PayoutAccountsModel from "../../models/payoutaccounts.model";
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

    if (carryRequest.status !== "accepted_pending_payment") {
      return res.status(400).json({
        message:
          "Carry request must be accepted before payment can be initiated",
      });
    }

    const existingPayment = await Payment.findOne({
      consignmentId: carryRequest.consignmentId,
      status: "pending",
    });
    if (existingPayment) {
      return res.status(400).json({ message: "Payment already initiated" });
    }

    // Create Razorpay order FIRST (before transaction)
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

    session.startTransaction();

    // console.log("ORDER RESPONSE FROM INITIATE PAYMENT => ", orderResponse);

    //  Handle the array destructuring properly
    const createdPayments = await Payment.create(
      [
        {
          consignmentId: carryRequest.consignmentId,
          travelId: carryRequest.travelId,
          userId: carryRequest.requestedBy,
          type: "sender_pay",
          amount: carryRequest.senderPayAmount,
          status: "pending",
          razorpayOrderId: orderResponse.data.id,
        },
      ],
      { session }
    );

    const paymentDoc = createdPayments[0];
    if (!paymentDoc) {
      throw new Error("Failed to create payment record");
    }

    await session.commitTransaction();

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

    payment.status = "completed_pending_webhook";
    payment.razorpayPaymentId = razorpayPaymentId;
    await payment.save({ session });

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

    // verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      logger.warn("❌ Razorpay webhook signature mismatch");
      return res.status(400).send("Invalid signature");
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
        if (payment.status === "completed" && event === "payment.captured") {
          logger.info("Payment already completed, skipping webhook processing");
          await session.abortTransaction();
          return res.status(200).send("Payment already processed");
        }

        if (event === "payment.captured") {
          // Update payment
          payment.status = "completed";
          payment.razorpayPaymentId = razorpayPaymentId;
          await payment.save({ session });

          // Update CarryRequest
          // console.log("Updating CarryRequest...");
          const carryRequest = await CarryRequest.findOneAndUpdate(
            {
              consignmentId: payment.consignmentId,
              status: "accepted_pending_payment",
            },
            { status: "accepted" },
            { new: true, session }
          );
          if (!carryRequest) throw new Error("CarryRequest not found");

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
            { new: true, session }
          );

          if (!updatedConsignment) {
            throw new Error("Failed to update consignment to 'assigned'");
          }

          // // Calculate platform commission
          const fareConfig = await FareConfigModel.findOne()
            .sort({ createdAt: -1 })
            .lean();
          if (!fareConfig) throw new Error("Fare configuration not found");

          const { margin } = fareConfig; // percentage margin

          const platformCommission = Number(
            ((carryRequest.senderPayAmount * margin) / 100).toFixed(2)
          );

          const existingTravelConsignment = await TravelConsignments.findOne({
            paymentId: payment._id,
          }).session(session);
          // console.log("Done with searching existing TravelConsignment...");

          if (!existingTravelConsignment) {
            // console.log(
            //   "Inside !existingTravelConsignment, searching for consignment..."
            // );
            const consignment = await ConsignmentModel.findById(
              payment.consignmentId
            )
              .select("receiverPhone receiverName")
              .lean()
              .session(session);
            if (!consignment) throw new Error("consignment not found");
            // console.log(
            //   "Inside !existingTravelConsignment, done searching for consignment..."
            // );

            // console.log(
            //   "Inside !existingTravelConsignment, searching for sender..."
            // );
            const sender = await User.findById(
              carryRequest.requestedBy
            ).session(session);
            const receiver = consignment;

            if (!sender || !receiver)
              throw new Error("Sender or receiver not found");

            // Generate OTPs now
            const [senderOTPObj, receiverOTPObj] = await Promise.all([
              generateOtp(sender.phoneNumber, "sender"),
              generateOtp(receiver.receiverPhone, "receiver"),
            ]);

            const senderOTP = senderOTPObj?.otp ?? "000000"; // fallback OTP
            const receiverOTP = receiverOTPObj?.otp ?? "000000"; // fallback OTP

            console.log(
              `Generated OTPs - sender: ${senderOTP}, receiver: ${receiverOTP}`
            );

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
                { session }
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
                  {
                    userId: null, // Platform commission
                    travelId: payment.travelId,
                    consignmentId: payment.consignmentId,
                    amount: platformCommission,
                    status: "pending",
                    is_withdrawn: false,
                    type: "platform_commission",
                  },
                ],
                { session }
              );
            } catch (error) {
              console.error("❌ Failed to create Earning record:", error);
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

          logger.info(
            `✅ Payment processed & commission recorded: ₹${platformCommission}`
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
            session
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

        // ================= PAYOUT EVENTS =================
      }
      // ------------ PAYOUT EVENTS -------------
      else if (event.startsWith("payout.")) {
        const payoutEntity = payload?.payout?.entity;
        if (!payoutEntity) throw new Error("Missing payout entity in payload");

        const { id: razorpayPayoutId, fund_account_id: fundAccountId } =
          payoutEntity;
        const { amount: payoutAmountInPaise } = payoutEntity;
        const payoutAmount = Number(payoutAmountInPaise) / 100;
        const notes = payoutEntity.notes || {}; // notes you set when creating payout
        const notedUserId = notes.userId ?? null;
        const notedConsignmentId = notes.consignmentId ?? null;
        const notedTravelId = notes.travelId ?? null;

        // IDempotency check to ensure payout record exists
        let existingPayout: PayoutDoc | null = await Payout.findOne({
          razorpayPayoutId,
        }).session(session);

        // determine userId by fund account lookup (preferred) or notes fallback
        let userId = null;
        if (fundAccountId) {
          const payoutAccount = await PayoutAccountsModel.findOne({
            razorpayFundAccountId: fundAccountId,
          }).session(session);
          if (payoutAccount) userId = payoutAccount.userId;
        }
        // fallback to notes.userId if fundAccount lookup didn't find
        if (!userId && notedUserId) {
          // ensure it's converted to ObjectId if it's a string
          try {
            userId = new mongoose.Types.ObjectId(notedUserId);
          } catch {
            // keep as null if invalid
            userId = null;
          }
        }

        if (event === "payout.processed") {
          if (!existingPayout) {
            logger.warn(
              "Existing payout not found, creating a payout record..."
            );

            const created = await Payout.create(
              [
                {
                  userId: userId,
                  travelId: notedTravelId
                    ? new mongoose.Types.ObjectId(notedTravelId)
                    : undefined,
                  consignmentId: notedConsignmentId
                    ? new mongoose.Types.ObjectId(notedConsignmentId)
                    : undefined,
                  amount: payoutAmount,
                  status: "completed",
                  razorpayPayoutId,
                  razorpayPaymentId: payoutEntity.payment_id || undefined,
                },
              ],
              { session }
            );

            existingPayout = created[0] ?? null; // <-- fallback to null if array is empty
          } else {
            // update existing record
            existingPayout.status = "completed";
            existingPayout.razorpayPaymentId =
              existingPayout.razorpayPaymentId || payoutEntity.payment_id;
            await existingPayout.save({ session });
          }

          // Mark corresponding earning(s) as withdrawn:
          // Only mark earnings that are already completed (delivered) and not withdrawn.
          // Prefer matching by consignmentId if available, otherwise by userId + amount as a fallback.
          if (existingPayout) {
            if (existingPayout.consignmentId) {
              await Earning.updateMany(
                {
                  userId: existingPayout.userId,
                  consignmentId: existingPayout.consignmentId,
                  status: "completed",
                  is_withdrawn: false,
                },
                {
                  $set: {
                    is_withdrawn: true,
                    withdrawnAt: new Date(),
                  },
                },
                { session }
              );
            }

            // partial payout logic (kinda flawed)
            // else if (userId) {
            //   // fallback: mark earliest completed earnings up to the payout amount
            //   // (implementation here tries to be conservative: find completed not withdrawn earnings and mark until sum >= payoutAmount)
            //   const earnings = await Earning.find(
            //     {
            //       userId,
            //       status: "completed",
            //       is_withdrawn: false,
            //     },
            //     null,
            //     { sort: { createdAt: 1 } }
            //   ).session(session);

            //   let remaining = payoutAmount;
            //   for (const e of earnings) {
            //     if (remaining <= 0) break;
            //     // if earning amount <= remaining, mark it withdrawn fully
            //     remaining -= e.amount;
            //     e.is_withdrawn = true;
            //     e.withdrawnAt = new Date();
            //     await e.save({ session });
            //   }
            // }
          }

          logger.info(`✅ Payout processed successfully: ${razorpayPayoutId}`);
        } else if (event === "payout.failed") {
          // mark existing payout as failed (if present)
          if (existingPayout) {
            existingPayout.status = "failed";
            existingPayout.failureReason = payoutEntity.failure_reason || "";
            await existingPayout.save({ session });
          } else {
            // create a failed record for bookkeeping
            await Payout.create(
              [
                {
                  userId: userId,
                  travelId: notedTravelId
                    ? new mongoose.Types.ObjectId(notedTravelId)
                    : undefined,
                  consignmentId: notedConsignmentId
                    ? new mongoose.Types.ObjectId(notedConsignmentId)
                    : undefined,
                  amount: payoutAmount,
                  status: "failed",
                  razorpayPayoutId,
                  failureReason: payoutEntity.failure_reason || "",
                },
              ],
              { session }
            );
          }

          logger.warn(
            `⚠️ Payout failed: ${razorpayPayoutId} reason: ${payoutEntity.failure_reason}`
          );
        } else {
          // Other payout events can be logged and ignored, e.g., payout.created, payout.processed etc.
          logger.info(`Unhandled payout event: ${event}`);
        }
      } // end payout branch

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
