import { z } from "zod";

export const travelSchema = z.object({
  travelerId: z.string().min(1, "Traveler ID is required"),

  fromAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),

  toAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),

  fromCoordinates: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),

  toCoordinates: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),

  expectedStartDate: z.coerce.date(),
  expectedEndDate: z.coerce.date(),

  modeOfTravel: z.enum(["air", "roadways", "train"]),
  vehicleType: z.enum(["car", "bus", "other"]).optional(),
  vehicleNumber: z.string().optional(),

  durationOfStay: z.object({
    days: z.number().nonnegative(),
    hours: z.number().nonnegative(),
  }),

  durationOfTravel: z.string(),
  status: z.enum(["upcoming", "ongoing", "completed", "cancelled"]),
});
export const createTravelSchema = travelSchema;
