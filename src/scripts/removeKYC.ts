import mongoose from "mongoose";
import env from "../lib/env";
import { User } from "../models/user.model";
import logger from "../lib/logger";
import connectDb from "../lib/connectDb";

async function removeKYC() {
  try {
    await connectDb(env.DATABASE_URL);
    logger.info("✅ Connected to MongoDB");

    const result = await User.updateMany(
      {},
      {
        $set: {
          isKYCVerified: false,
          "kyc.overallStatus": "not_started",
          "kyc.ind_pan": { status: "not_provided" },
          "kyc.ind_aadhaar": { status: "not_provided" },
          "kyc.ind_driving_license": { status: "not_provided" },
          "kyc.face": { status: "not_provided" },
        },
        $unset: {
          "kyc.groupId": "",
          "kyc.updatedAt": "",
        }
      }
    );

    logger.info(`✅ Reset KYC for ${result.modifiedCount} users.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error removing KYC:", error);
    process.exit(1);
  }
}

removeKYC();
