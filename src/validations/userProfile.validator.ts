import z from "zod";
export const updateUserProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name cannot be empty")
    .max(50, "First name too long")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name cannot be empty")
    .max(50, "Last name too long")
    .optional(),
  email: z
    .union([z.string().email("Invalid email format"), z.literal("")])
    .optional(),
});
