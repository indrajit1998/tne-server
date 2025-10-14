import { Router } from "express";

import {
  getNotifications,
  markAllRead,
  markNotificationRead,
} from "../../controllers/Notifications/notification";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const notificationRouter = Router();

notificationRouter.get("/", isAuthMiddleware, getNotifications);
notificationRouter.patch("/readAll", isAuthMiddleware, markAllRead);
notificationRouter.patch("/:id/read", isAuthMiddleware, markNotificationRead);

export default notificationRouter;
