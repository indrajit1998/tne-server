import mongoose from "mongoose";
import env from "../lib/env";
import { User } from "../models/user.model";

async function fixIndexes() {
  await mongoose.connect(env.DATABASE_URL); // use your URI

  // 1️⃣ List all indexes
  const indexes = await User.collection.indexes();
  console.log("Current indexes:", indexes);

  // 2️⃣ Drop old email index if it exists
  const emailIndex = indexes.find((idx) => idx.key.email === 1);
  if (emailIndex && emailIndex.name) {
    console.log("Dropping old email index:", emailIndex.name);
    await User.collection.dropIndex(emailIndex.name);
  }

  // 3️⃣ Create sparse unique index
  console.log("Creating sparse unique index on email");
  await User.collection.createIndex(
    { email: 1 },
    { unique: true, sparse: true }
  );

  console.log("✅ Done!");
  await mongoose.disconnect();
}

fixIndexes().catch(console.error);
