import { z } from "zod";

export const getNotificationsValidator = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("20"),
});

export const markReadValidator = z.object({
  id: z.string().length(24), // MongoDB ObjectId length
});
