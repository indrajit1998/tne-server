import crypto from "crypto";
import env from "./env";

const ENCRYPTION_KEY = env.BANK_ENCRYPTION_KEY; // 32-byte key
const IV_LENGTH = 16; // For AES, this is always 16

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedData: string): string {
  const textParts = encryptedData.split(":");
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = textParts.join(":");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length > 4
    ? "****" + accountNumber.slice(-4)
    : accountNumber;
}
