import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { CODES } from "./constants/statusCodes";
import sendResponse from "./lib/ApiResponse";
import connectDb from "./lib/connectDb";
import env from "./lib/env";
import logger from "./lib/logger";
import errorHandler from "./middlewares/errorHandler";
import requestLogger from "./middlewares/requestLogger";
import addressRouter from "./routes/address/address.router";
import adminRouts from "./routes/admin/admin";
import consignmentRoutes from "./routes/Consignment/consignment";
import feedbackOrContactRoute from "./routes/feedbackOrContact/feedbackOrContact.route";
import locationRouter from "./routes/location/location.router";
import authRoutes from "./routes/UserRouts/auth";
import profileRoutes from "./routes/UserRouts/profile";
import travelRoutes from "./routes/UserRouts/travel";

const PORT = parseInt(env.PORT, 10);

const app = express();
connectDb(env.DATABASE_URL);

app.use(cors());
app.use(express.json());

app.use(requestLogger);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Auth and profile
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", profileRoutes);

// search location
app.use("/api/v1/location", locationRouter);

// publish
app.use("/api/v1/consignment", consignmentRoutes);
app.use("/api/v1/travel", travelRoutes);

// create and get addresses
app.use("/api/v1/address", addressRouter);

// admin
app.use("/api/v1/admin", adminRouts);

// feedback
app.use("/api/v1/feedback", feedbackOrContactRoute);

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
  logger.info(`Server is running at http://localhost:${PORT}`);
});
