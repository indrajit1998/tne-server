import express from "express";
import cors from "cors";
import env from "./lib/env";
import logger from "./lib/logger";
import requestLogger from "./middlewares/requestLogger";
import errorHandler from "./middlewares/errorHandler";
import sendResponse from "./lib/ApiResponse";
import { CODES } from "./constants/statusCodes";

const PORT = parseInt(env.PORT, 10);

const app = express();

app.use(cors());
app.use(express.json());

app.use(requestLogger);

app.get("/", (req, res) => {
  res
    .status(CODES.OK)
    .json(sendResponse(200, null, "Welcome to Travel Earn API"));
});

app.use((req, res, next) => {
  res
    .status(CODES.NOT_FOUND)
    .send("404 Not Found - The requested URL was not found on this server.");
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
