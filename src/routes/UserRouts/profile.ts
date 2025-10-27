import { Router } from "express";
import {
  addFundAccount,
  createRazorpayCustomerId,
  getProfile,
  getTravelAndConsignment,
  getUserBankDetails,
  getUserEarnings,
  getUserFundAccounts,
  saveUserBankDetails,
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

// Bank Details Routes
profileRouter.get("/bankDetails", isAuthMiddleware, getUserBankDetails);
profileRouter.post("/bankDetails", isAuthMiddleware, saveUserBankDetails);
profileRouter.put("/bankDetails", isAuthMiddleware, saveUserBankDetails);

// Fund Accounts & Withdrawals
profileRouter.get("/fundAccounts", isAuthMiddleware, getUserFundAccounts);
profileRouter.post("/addFundAccount", isAuthMiddleware, addFundAccount);
profileRouter.put("/withdrawFunds", isAuthMiddleware, withdrawFunds);
profileRouter.get("/earnings", isAuthMiddleware, getUserEarnings);

export default profileRouter;
