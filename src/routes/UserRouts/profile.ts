import { Router } from "express";
import { addAddress } from "../../controllers/address.controller.js";
import {
  addFunds,
  createRazorpayCustomerId,
  getProfile,
  getTravelAndConsignment,
  getUserEarnings,
  withdrawFunds,
} from "../../controllers/UserController/profileController.js";
import isAuthMiddleware from "../../middlewares/authMiddleware.js";

const profileRouter = Router();

profileRouter.get("/getprofile", isAuthMiddleware, getProfile);
profileRouter.get(
  "/getTravelAndConsignment",
  isAuthMiddleware,
  getTravelAndConsignment
);
profileRouter.patch(
  "/createRazorpayCustomerId",
  isAuthMiddleware,
  createRazorpayCustomerId
);
profileRouter.post("/addFunds", isAuthMiddleware, addFunds);
profileRouter.put("/withdrawFunds", isAuthMiddleware, withdrawFunds);
profileRouter.get("/earnings", isAuthMiddleware, getUserEarnings);
// profileRouter.get("/earnings/summary", isAuthMiddleware, getUserEarnings);

export default profileRouter;
