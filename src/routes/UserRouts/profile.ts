import { Router } from "express";
import { addAddress } from "../../controllers/address.controller.js";
import {
  addFundAccount,
  createRazorpayCustomerId,
  getProfile,
  getTravelAndConsignment,
  getUserEarnings,
  getUserFundAccounts,
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
profileRouter.get("/fundAccounts", isAuthMiddleware, getUserFundAccounts);
profileRouter.post("/addFundAccount", isAuthMiddleware, addFundAccount);
profileRouter.put("/withdrawFunds", isAuthMiddleware, withdrawFunds);
profileRouter.get("/earnings", isAuthMiddleware, getUserEarnings);

export default profileRouter;
