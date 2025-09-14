import z from "zod";

const addressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  label: z.string().min(1, "Label is required"),
  coordinates: z.object({
    lat: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
    lng: z
      .number()
      .min(-180)
      .max(180, "Longitude must be between -180 and 180"),
  }),
  flatNo: z.string().min(1, "Flat number is required"),
  landMark: z.string().optional(),
});

export { addressSchema };
