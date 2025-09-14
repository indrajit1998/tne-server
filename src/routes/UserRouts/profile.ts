import { Router } from "express";
import {
  getProfile,
  getTravelAndConsignment,
} from "../../controllers/UserController/profileController.js";
import isAuthMiddleware from "../../middlewares/authMiddleware.js";
import { addAddress } from "../../controllers/address.controller.js";

const profileRouter = Router();
profileRouter.get("/getprofile", isAuthMiddleware, getProfile);
profileRouter.get(
  "/getTravelAndConsignment",
  isAuthMiddleware,
  getTravelAndConsignment
);
export default profileRouter;
