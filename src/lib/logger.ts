import pino from "pino";
import env from "./env";

const isProd = env.NODE_ENV === "production";

const logger = pino({
  level: isProd ? "info" : "debug",
  base: {
    pid: true,
    hostname: true,
    app: env.APP_NAME || "my-app",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
    ],
    censor: "[REDACTED]",
  },
  transport: isProd
    ? {
        target: "@logtail/pino",
        options: {
          sourceToken: env.LOGTAIL_SOURCE_TOKEN!,
        },
      }
    : {
        target: "pino-pretty",
        options: { colorize: true },
      },
});

export default logger;
