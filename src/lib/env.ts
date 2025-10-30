import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("4000"),
  APP_NAME: z.string().default("tne-server"),
  APP_URL: z.string().default("http://localhost:3000"), //TODO: Add proper url
  LOGTAIL_SOURCE_TOKEN: z.string().optional(),
  DATABASE_URL: z.url(),
  SEND_MESSAGE_API_KEY: z.string(),
  JWT_SECRET: z
    .string()
    .min(8, "JWT_SECRET must be at least 8 characters long"),
  GOOGLE_MAPS_API_KEY: z
    .string()
    .min(8, "GOOGLE_MAPS_API_KEY must be at least 8 characters long"),
  RAZORPAY_KEY_ID: z.string(),
  RAZORPAY_KEY_SECRET: z.string(),
  RAZORPAY_ACCOUNT_NUMBER: z.string(),
  RAZORPAY_WEBHOOK_SECRET: z.string(),
  BANK_ENCRYPTION_KEY: z.string(),
  IDFY_BASE_URL: z.string(),
  IDFY_ACCOUNT_ID: z.string(),
  IDFY_API_KEY: z.string(),
  IDFY_WEBHOOK_SECRET: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === "production" && !env.LOGTAIL_SOURCE_TOKEN) {
  console.error("LOGTAIL_SOURCE_TOKEN is required in production");
  process.exit(1);
}

export default env;
