import { Router } from "express";

import {
  getNotifications,
  markAllRead,
  markNotificationRead,
} from "../../controllers/Notifications/notification";
import isAuthMiddleware from "../../middlewares/authMiddleware";
import {
  capturePayment,
  initiatePayment,
  razorpayWebhook,
} from "../../controllers/Payment/payment.controller";

const paymentRouter = Router();

paymentRouter.post("/", isAuthMiddleware, initiatePayment); // Create Razorpay order
paymentRouter.post("/capture", isAuthMiddleware, capturePayment); // FE confirms payment
paymentRouter.post("/webhook", razorpayWebhook); // Razorpay server → your backend

export default paymentRouter;
