import mongoose from "mongoose";
import env from "../lib/env";
import FareConfigModel from "../models/fareconfig.model";

async function main() {
  try {
    await mongoose.connect(env.DATABASE_URL);
    console.log("✅ Connected to MongoDB");

    const existing = await FareConfigModel.findOne();
    if (existing) {
      console.log("⚠️ FareConfig already exists:", existing._id);
      process.exit(0);
    }

    const config = await FareConfigModel.create({
      TE: 0.18,
      deliveryFee: 100,
      margin: 1.1,
      weightRateTrain: 5,
      distanceRateTrain: 2,
      baseFareTrain: 100,
      weightRateFlight: 10,
      distanceRateFlight: 5,
      baseFareFlight: 300,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("✅ FareConfig seeded successfully:", config._id);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding FareConfig:", err);
    process.exit(1);
  }
}

main();
