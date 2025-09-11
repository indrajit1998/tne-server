import pinoHttp from "pino-http";
import logger from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    return req.headers["x-request-id"]?.toString() || uuidv4();
  },
  customLogLevel: (res, err) => {
    const statusCode = res.statusCode ?? 500;

    if (err || statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode ?? 500,
    }),
  },
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },
});

export default requestLogger;
