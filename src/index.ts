import express from "express";
import cors from "cors";
import env from "./lib/env";
import logger from "./lib/logger";
import requestLogger from "./middlewares/requestLogger";
import errorHandler from "./middlewares/errorHandler";
import sendResponse from "./lib/ApiResponse";
import authRoutes from "./routes/UserRouts/auth";
import profileRoutes from "./routes/UserRouts/profile";
import { CODES } from "./constants/statusCodes";
import cookieParser from "cookie-parser";
import connectDb from "./lib/connectDb";
import locationRouter from "./routes/location/location.router";

const PORT = parseInt(env.PORT, 10);

const app = express();
connectDb(env.DATABASE_URL);

app.use(cors());
app.use(express.json());

app.use(requestLogger);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", profileRoutes);
app.use("/api/v1/location", locationRouter);

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
