import { z } from "zod";
import mongoose from "mongoose";

// 🔹 Helper: validate MongoDB ObjectId
const objectId = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId",
});

// 🔹 Dimensions schema
const dimensionsSchema = z.object({
  length: z.number().positive("Length must be greater than 0"),
  width: z.number().positive("Width must be greater than 0"),
  height: z.number().positive("Height must be greater than 0"),
  unit: z.enum(["cm", "m", "inches"]),
});

// 🔹 Main schema
export const createConsignmentSchema = z.object({
  body: z.object({
    fromAddressId: objectId,
    toAddressId: objectId,
    weight: z.number().positive("Weight must be greater than 0"),
    weightUnit: z.enum(["kg", "gram", "lb"]),
    dimensions: dimensionsSchema,
    sendingDate: z.string().datetime({ offset: true }),
    receiverName: z.string().min(2, "Receiver name is required"),
    receiverPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
    category: z.enum(["document", "non-document"]),
    subCategory: z.string().optional(),
    description: z.string().min(5, "Description must be at least 5 characters"),
    handleWithCare: z.boolean(),
    images: z.array(z.string().url("Each image must be a valid URL")).nonempty("At least one image is required"),
    status: z.enum(["published", "requested", "in-transit", "delivered", "cancelled", "assigned"]),
  }),
});

// ✅ Inferred Type
export type CreateConsignmentInput = z.infer<typeof createConsignmentSchema>["body"];
