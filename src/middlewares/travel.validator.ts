import { z } from "zod";
import mongoose from "mongoose";

// Helper to validate ObjectId
const objectId = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId",
  });

// Address ID validation
const addressIdSchema = objectId;

// DurationOfStay validation
const durationOfStaySchema = z.object({
  days: z.number().min(0, "Days must be >= 0"),
  hours: z.number().min(0, "Hours must be >= 0").max(23, "Hours must be <= 23"),
});

// Main Travel validator
export const createTravelSchema = z.object({
  body: z.object({
    fromAddressId: addressIdSchema,
    toAddressId: addressIdSchema,
    expectedStartDate: z.iso.datetime({ offset: true }),
    expectedEndDate: z.iso.datetime({ offset: true }),
    modeOfTravel: z.enum(["air", "roadways", "train"]),
    vehicleType: z.enum(["car", "bus", "other"]).optional(),
    vehicleNumber: z.string().optional(),
    durationOfStay: durationOfStaySchema,
  }),
});

export type CreateTravelInput = z.infer<typeof createTravelSchema>["body"];
