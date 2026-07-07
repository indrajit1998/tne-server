import mongoose from "mongoose";
import env from "../lib/env";
import { User } from "../models/user.model";
import { Address } from "../models/address.model";
import ConsignmentModel from "../models/consignment.model";
import { TravelModel } from "../models/travel.model";
import { CarryRequest } from "../models/carryRequest.model";
import Payment from "../models/payment.model";
import TravelConsignments from "../models/travelconsignments.model";
import logger from "../lib/logger";
import connectDb from "../lib/connectDb";

async function deleteTestUsers() {
  try {
    await connectDb(env.DATABASE_URL);
    logger.info("✅ Connected to MongoDB");

    const args = process.argv.slice(2);
    // Use defaults from test_auth_flow.js if none provided
    const SENDER_PHONE = args[0] || "+917843835159";
    const TRAVELLER_PHONE = args[1] || "+917267011026";

    const phonesToDrop = [SENDER_PHONE, TRAVELLER_PHONE];
    logger.info(
      `🔍 Searching for users with phones: ${phonesToDrop.join(", ")}`,
    );

    const users = await User.find({ phoneNumber: { $in: phonesToDrop } });
    const userIds = users.map((u) => u._id);

    if (userIds.length === 0) {
      logger.info("⚠️ No users found with the provided phone numbers.");
      process.exit(0);
    }

    logger.info(`🎯 Found ${userIds.length} users. IDs: ${userIds.join(", ")}`);

    // 1. Get associated Travel & Consignment IDs first
    const travels = await TravelModel.find({ travelerId: { $in: userIds } });
    const travelIds = travels.map((t) => t._id);

    const consignments = await ConsignmentModel.find({
      senderId: { $in: userIds },
    });
    const consignmentIds = consignments.map((c) => c._id);

    // 2. TravelConsignments
    if (travelIds.length > 0 || consignmentIds.length > 0) {
      const tcQuery = [];
      if (travelIds.length > 0) tcQuery.push({ travelId: { $in: travelIds } });
      if (consignmentIds.length > 0)
        tcQuery.push({ consignmentId: { $in: consignmentIds } });

      const tcRes = await TravelConsignments.deleteMany({ $or: tcQuery });
      logger.info(`🗑️  Deleted ${tcRes.deletedCount} TravelConsignments.`);
    }

    // 3. CarryRequests
    const crQuery = [
      { travellerId: { $in: userIds } },
      { requestedBy: { $in: userIds } },
    ];
    if (travelIds.length > 0) crQuery.push({ travelId: { $in: travelIds } });
    if (consignmentIds.length > 0)
      crQuery.push({ consignmentId: { $in: consignmentIds } });

    const crRes = await CarryRequest.deleteMany({ $or: crQuery });
    logger.info(`🗑️  Deleted ${crRes.deletedCount} CarryRequests.`);

    // 4. Payments
    const payQuery = [{ userId: { $in: userIds } }];
    if (travelIds.length > 0) payQuery.push({ travelId: { $in: travelIds } });
    if (consignmentIds.length > 0)
      payQuery.push({ consignmentId: { $in: consignmentIds } });

    const payRes = await Payment.deleteMany({ $or: payQuery });
    logger.info(`🗑️  Deleted ${payRes.deletedCount} Payments.`);

    // 5. Addresses
    const addrRes = await Address.deleteMany({ userId: { $in: userIds } });
    logger.info(`🗑️  Deleted ${addrRes.deletedCount} Addresses.`);

    // 6. Travels
    const travelRes = await TravelModel.deleteMany({
      travelerId: { $in: userIds },
    });
    logger.info(`🗑️  Deleted ${travelRes.deletedCount} Travels.`);

    // 7. Consignments
    const consigRes = await ConsignmentModel.deleteMany({
      senderId: { $in: userIds },
    });
    logger.info(`🗑️  Deleted ${consigRes.deletedCount} Consignments.`);

    // 8. Users
    const userRes = await User.deleteMany({ _id: { $in: userIds } });
    logger.info(`🗑️  Deleted ${userRes.deletedCount} Users.`);

    logger.info("🎉 All related test data deleted completely!");
    await mongoose.disconnect();
  } catch (error: any) {
    console.error("❌ Error deleting test users:", error);
    logger.error(error, "❌ Error deleting test users");
    process.exit(1);
  }
}

deleteTestUsers();
