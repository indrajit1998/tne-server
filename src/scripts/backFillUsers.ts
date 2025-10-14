import mongoose from "mongoose";
import env from "../lib/env";
import { User } from "../models/user.model";

const MONGO_URI = env.DATABASE_URL || "mongodb+srv://<your_connection_string>";

async function backfillUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const result = await User.updateMany(
      { rating: { $exists: false } },
      {
        $set: {
          rating: 0,
          reviewCount: 0,
          totalEarnings: 0,
          completedTrips: 0,
        },
      }
    );

    console.log(`🎯 Updated ${result.modifiedCount} users`);
    await mongoose.disconnect();
    console.log("✅ Done and disconnected");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

backfillUsers();
