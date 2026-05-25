import { Router } from "express";
import { startAadhaarKyc, getAadhaarKycStatus, getKycStatus, cashfreeWebhook,  } from "../../controllers/cashfree/cashfree.controller";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const kycRouter = Router();

// Start OTP-based Aadhaar EKYC verification
kycRouter.get("/url", isAuthMiddleware, startAadhaarKyc);

// Fetch current KYC status
kycRouter.get("/status", isAuthMiddleware, getKycStatus);

// Manually retry task fetch (optional, dev/admin only)
kycRouter.get("/fetch-result", isAuthMiddleware, getAadhaarKycStatus);

//  Public webhook — called by Cashfree when async task completes

kycRouter.post("/webhook", cashfreeWebhook);


export default kycRouter;
