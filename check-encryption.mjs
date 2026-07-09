import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

const ENCRYPTION_KEY = Buffer.from(process.env.BANK_ENCRYPTION_KEY, "base64");

function decrypt(encryptedData) {
  const textParts = encryptedData.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = textParts.join(":");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const payoutSchema = new mongoose.Schema({}, { strict: false });
const Payout = mongoose.model('Payout', payoutSchema);

async function run() {
  console.log("Connecting to:", process.env.DATABASE_URL);
  await mongoose.connect(process.env.DATABASE_URL);
  
  const payouts = await Payout.find({}).limit(20);
  console.log(`Found ${payouts.length} payouts.`);
  
  for (const payout of payouts) {
    const userId = payout.get('userId');
    const user = await User.findById(userId);
    if (!user) {
        console.log(`Payout ${payout._id}: User not found`);
        continue;
    }
    const enc = user.get('bankDetails.accountNumberEncrypted');
    console.log("Payout ID:", payout._id, "User ID:", userId);
    
    if (enc) {
      console.log("Encrypted string:", enc);
      try {
        const dec = decrypt(enc);
        console.log("Successfully Decrypted:", dec);
      } catch (e) {
        console.error("!!! Decryption failed for this user !!!:", e.message);
      }
    } else {
      console.log("No encrypted account number for this user.");
    }
    console.log("---");
  }
  process.exit(0);
}

run().catch(console.error);
