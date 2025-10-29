import { Router } from "express";
import {
  getKycStatus,
  idfyWebhook,
  retryFetchResult,
  startDocumentVerification,
  startFaceVerification,
} from "../../controllers/Idfy/idfy.controller";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const kycRouter = Router();

// Start OCR-based KYC verification (PAN / Aadhaar / Driving License)
kycRouter.post("/start", isAuthMiddleware, startDocumentVerification);

// Start selfie (face liveness) verification
kycRouter.post("/selfie", isAuthMiddleware, startFaceVerification);

// Fetch current KYC status
kycRouter.get("/status", isAuthMiddleware, getKycStatus);

// Manually retry task fetch (optional, dev/admin only)
kycRouter.post("/fetch-result", isAuthMiddleware, retryFetchResult);

//  Public webhook — called by IDfy when async task completes

kycRouter.post("/webhook", idfyWebhook);

export default kycRouter;
