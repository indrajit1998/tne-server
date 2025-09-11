import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("4000"),
  APP_NAME: z.string().default("tne-server"),
  LOGTAIL_SOURCE_TOKEN: z.string().optional(),
  DATABASE_URL: z.url(),
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
