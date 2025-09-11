import mongoose, { Schema } from "mongoose";

interface Verification {
  phoneNumber: string;
  code: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationSchema = new Schema<Verification>(
  {
    phoneNumber: { type: String, required: true },
    code: { type: Number, required: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000),
    },
  },
  { timestamps: true }
);

VerificationSchema.index({ phoneNumber: 1, code: 1 }, { unique: true });
VerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Verification = mongoose.model<Verification>(
  "Verification",
  VerificationSchema
);
