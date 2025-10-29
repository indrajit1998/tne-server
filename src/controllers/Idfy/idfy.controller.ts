import type { Response } from "express";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import logger from "../../lib/logger";
import type { AuthRequest } from "../../middlewares/authMiddleware";
import { KycTask } from "../../models/kycTask.model";
import { User } from "../../models/user.model";
import {
  createFaceLivenessTask,
  createOcrExtractionTask,
  fetchTaskResult,
} from "../../services/idfy.service";

/**
 * Allowed types and mapping to readable names
 */
const DOC_TYPES = {
  ind_pan: "ind_pan",
  ind_aadhaar: "ind_aadhaar",
  ind_driving_license: "ind_driving_license",
  // face: "face",
} as const;

type KycDocType = keyof typeof DOC_TYPES;

/**
 * Helper — create KycTask document
 */
async function createKycTaskRecord(params: {
  userId: Types.ObjectId;
  groupId: string;
  taskType: string;
  taskId?: string;
  requestId?: string;
  initialStatus?: "pending" | "in_progress" | "completed" | "failed";
  raw?: any;
}) {
  const {
    userId,
    groupId,
    taskType,
    taskId,
    requestId,
    initialStatus = "pending",
    raw,
  } = params;
  const task = await KycTask.create({
    userId,
    groupId,
    taskType,
    taskId,
    requestId,
    status: initialStatus,
    result: raw ? { meta: raw } : undefined,
  });
  return task;
}

/**
 * POST /api/v1/kyc/start
 * Body:
 * {
 *   type: "ind_pan" | "ind_aadhaar" | "ind_driving_license",
 *   document1: "<base64 or url>",
 *   document2?: "<base64 or url>",   // required for aadhaar (back) and dl (back)
 *   groupId?: "<reuse group id>",
 *   extra?: { consent?: "yes" } // for aadhaar
 * }
 */
export const startDocumentVerification = async (
  req: AuthRequest,
  res: Response
) => {
  const userId = req.user;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { type, document1, document2, groupId, extra } = req.body || {};

  // Basic validation
  if (
    !type ||
    !["ind_pan", "ind_aadhaar", "ind_driving_license"].includes(type)
  ) {
    return res.status(400).json({ message: "Invalid or missing `type`" });
  }
  if (!document1 || typeof document1 !== "string") {
    return res
      .status(400)
      .json({ message: "document1 (image base64 or URL) is required" });
  }

  // Aadhaar requires consent per docs
  if (type === "ind_aadhaar") {
    const consent = extra?.consent || req.body?.consent;
    if (
      !consent ||
      typeof consent !== "string" ||
      !["yes", "no"].includes(consent)
    ) {
      return res
        .status(400)
        .json({ message: "Aadhaar requires `consent: 'yes'|'no'` in `extra`" });
    }
    // also document2 (back) is required for aadhaar in docs
    if (!document2) {
      return res
        .status(400)
        .json({ message: "Aadhaar requires document2 (back image) as well" });
    }
  }

  // Driving license expects front+back
  if (type === "ind_driving_license" && !document2) {
    return res
      .status(400)
      .json({ message: "Driving license requires document2 (back image)" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Call IDfy OCR extract endpoint
    const opts = {
      document1,
      document2,
      groupId,
      extra,
    };

    const {
      taskId,
      groupId: gid,
      requestId,
      raw,
    } = await createOcrExtractionTask(type as KycDocType, opts);

    // Persist KycTask
    const kycTask = await createKycTaskRecord({
      userId: new mongoose.Types.ObjectId(
        typeof userId === "string" ? userId : userId._id
      ),
      groupId: gid,
      taskType: type,
      taskId,
      requestId,
      initialStatus: "pending",
      raw,
    });

    // Update user's kyc subdoc: set requestId and status -> pending, set groupId
    const update: any = {
      "kyc.groupId": gid,
      [`kyc.${type}.requestId`]: requestId,
      [`kyc.${type}.status`]: "pending",
      "kyc.overallStatus": "pending",
      "kyc.updatedAt": new Date(),
    };

    await User.findByIdAndUpdate(userId, { $set: update }, { session });

    await session.commitTransaction();

    logger.info(
      { userId, type, taskId, requestId, groupId: gid },
      "KYC document verification started"
    );

    return res.status(200).json({
      message: "kyc_verification_started",
      type,
      requestId,
      groupId: gid,
    });
  } catch (err: any) {
    await session.abortTransaction();
    logger.error(
      { err, body: req.body, userId },
      "startDocumentVerification failed"
    );
    return res.status(500).json({
      message: "Failed to start document verification",
      error: err?.message || "internal_error",
    });
  } finally {
    session.endSession();
  }
};

// export const startDocumentVerification = async (
//   req: AuthRequest,
//   res: Response
// ) => {
//   try {
//     console.log("✅ REACHED BACKEND /kyc/start");
//     console.log("📥 BODY:", req.body);

//     // Just return a dummy success response
//     return res.status(200).json({
//       success: true,
//       message: "Dummy KYC start reached successfully",
//       receivedData: req.body,
//     });
//   } catch (error) {
//     console.error("❌ Error in dummy /kyc/start:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Something went wrong in dummy endpoint",
//     });
//   }
// };

/**
 * POST /api/v1/kyc/selfie
 * Body: { image: "<base64 or url>", groupId?: string, options?: {} }
 */
export const startFaceVerification = async (
  req: AuthRequest,
  res: Response
) => {
  const userId = req.user;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { image, groupId, options } = req.body || {};

  if (!image || typeof image !== "string") {
    return res
      .status(400)
      .json({ message: "Image (base64 or URL) is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      taskId,
      groupId: gid,
      requestId,
      raw,
    } = await createFaceLivenessTask(image, groupId, options);

    // Persist KycTask
    await createKycTaskRecord({
      userId: new mongoose.Types.ObjectId(
        typeof userId === "string" ? userId : userId._id
      ),
      groupId: gid,
      taskType: "face",
      taskId,
      requestId,
      initialStatus: "pending",
      raw,
    });

    // Update user kyc
    const update: any = {
      "kyc.groupId": gid,
      "kyc.face.requestId": requestId,
      "kyc.face.status": "pending",
      "kyc.overallStatus": "pending",
      "kyc.updatedAt": new Date(),
    };

    await User.findByIdAndUpdate(userId, { $set: update }, { session });

    await session.commitTransaction();

    logger.info(
      { userId, taskId, requestId, groupId: gid },
      "Face verification started"
    );

    return res.status(200).json({
      message: "face_verification_started",
      requestId,
      groupId: gid,
    });
  } catch (err: any) {
    await session.abortTransaction();
    logger.error(
      { err, body: req.body, userId },
      "startFaceVerification failed"
    );
    return res.status(500).json({
      message: "Failed to start face verification",
      error: err?.message || "internal_error",
    });
  } finally {
    session.endSession();
  }
};

// export const startSelfieVerification = async (
//   req: AuthRequest,
//   res: Response
// ) => {
//   try {
//     console.log("✅ REACHED BACKEND /kyc/selfie");
//     console.log("📥 BODY:", req.body);

//     // Just return a dummy success response
//     return res.status(200).json({
//       success: true,
//       message: "Dummy selfie verification start reached successfully",
//       receivedData: req.body,
//     });
//   } catch (error) {
//     console.error("❌ Error in dummy /kyc/selfie:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Something went wrong in dummy selfie verification endpoint",
//     });
//   }
// };

/**
 * GET /api/v1/kyc/status
 * Returns user's KYC subdocument and isKYCVerified flag
 */
export const getKycStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const user = await User.findById(userId).select(
      "kyc isKYCVerified firstName lastName phoneNumber"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({
      kyc: user.kyc || {},
      isKYCVerified: user.isKYCVerified || false,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
    });
  } catch (err: any) {
    logger.error({ err, userId }, "getKycStatus failed");
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /api/v1/kyc/fetch-result
 * Optional admin/debug endpoint to manually fetch a task result from IDfy using requestId
 * Body: { requestId: string }
 */
export const retryFetchResult = async (req: AuthRequest, res: Response) => {
  const userId = req.user;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { requestId } = req.body || {};
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ message: "requestId is required" });
  }

  try {
    const resp = await fetchTaskResult(requestId);
    // resp is the IDfy GET response (array or object depending on API)
    logger.info({ requestId, resp }, "Fetched task result via manual retry");

    return res.status(200).json({ requestId, resp });
  } catch (err: any) {
    logger.error({ err, requestId }, "retryFetchResult failed");
    return res
      .status(500)
      .json({ message: "Failed to fetch result", error: err?.message });
  }
};

/**
 * IDfy Webhook Handler
 * Called by IDfy when a task completes or fails.
 * This route must be PUBLIC (no auth, no middlewareHandler)
 */
// export const idfyWebhook = async (req: AuthRequest, res: Response) => {
//   try {
//     //  Verify signature first
//     // const isVerified = verifyIdfySignature(req);
//     // if (!isVerified) {
//     //   return res.status(401).json({ message: "Invalid signature" });
//     // }

//     const payload = req.body;
//     logger.info({ payload }, "[WEBHOOK] 🔔 Received IDfy Webhook");

//     const { request_id, task_id, group_id, status, result, type } = payload;

//     if (!request_id || !group_id) {
//       logger.warn("[WEBHOOK] ⚠️ Missing request_id or group_id");
//       return res.status(400).json({ message: "Invalid webhook payload" });
//     }

//     // 1 Update the KycTask first
//     const task = await KycTask.findOneAndUpdate(
//       { requestId: request_id },
//       {
//         taskId: task_id,
//         status: status?.toLowerCase() || "completed",
//         result: result || {},
//         updatedAt: new Date(),
//       },
//       { new: true }
//     );

//     if (!task) {
//       logger.warn({ request_id }, "[WEBHOOK] ⚠️ Task not found for request_id");
//       return res
//         .status(200)
//         .json({ message: "Task not found, but acknowledged" });
//     }

//     logger.info(
//       { taskId: task._id, taskType: task.taskType },
//       "[WEBHOOK] ✅ Task updated"
//     );

//     if (
//       task &&
//       task.status === "completed" &&
//       ["completed", "success"].includes(status?.toLowerCase())
//     ) {
//       logger.info(
//         { request_id },
//         "[WEBHOOK] Duplicate verified webhook ignored"
//       );
//       return res
//         .status(200)
//         .json({ message: "Duplicate verified webhook ignored" });
//     }

//     // 2 Find the user by groupId
//     const user = await User.findOne({ "kyc.groupId": group_id });
//     if (!user) {
//       console.warn("[WEBHOOK] ⚠️ No user found for group:", group_id);
//       return res.status(200).json({ message: "User not found" });
//     }

//     // skip downgrading verified fields
//     // const currentStatus = user.kyc[kycType]?.status;
//     // if (currentStatus === "verified" && overallStatus !== "verified") {
//     //   logger.info(
//     //     { kycType, currentStatus, finalStatus },
//     //     "[WEBHOOK] Ignoring downgrade of verified KYC"
//     //   );
//     //   return res.status(200).json({ message: "Verified field not downgraded" });
//     // }

//     const kycType = task.taskType; // 'ind_aadhaar', 'face'
//     const finalStatus = (status || "").toLowerCase();
//     const isSuccess = ["completed", "success"].includes(finalStatus);
//     const isFailed = finalStatus === "failed";

//     // Map to correct subdocument
//     if (kycType === "face") {
//       const isLive =
//         result?.is_live === true || result?.result?.is_live === true;
//       user.kyc.face.status =
//         isSuccess && isLive ? "verified" : isFailed ? "failed" : "pending";
//       user.kyc.face.requestId = request_id;
//     } else if (
//       ["ind_pan", "ind_aadhaar", "ind_driving_license"].includes(kycType)
//     ) {
//       // Type assertion to ensure kycType is valid
//       const docType = kycType as
//         | "ind_pan"
//         | "ind_aadhaar"
//         | "ind_driving_license";
//       user.kyc[docType].status = isSuccess
//         ? "verified"
//         : isFailed
//         ? "failed"
//         : "pending";
//       user.kyc[docType].requestId = request_id;
//     }

//     user.kyc.groupId = group_id;
//     user.kyc.updatedAt = new Date();

//     // 3 Update overall KYC state
//     const panVerified = user.kyc.ind_pan.status === "verified";
//     const aadhaarVerified = user.kyc.ind_aadhaar.status === "verified";
//     const dlStatus = user.kyc.ind_driving_license.status;
//     const faceVerified = user.kyc.face.status === "verified";

//     const dlProvided = dlStatus !== "not_provided";
//     const dlVerified = dlStatus === "verified";

//     if (
//       (panVerified || aadhaarVerified) &&
//       faceVerified &&
//       (!dlProvided || dlVerified)
//     ) {
//       user.kyc.overallStatus = "verified";
//       user.isKYCVerified = true;
//     } else if (
//       ["failed"].includes(
//         user.kyc.ind_pan.status ||
//           user.kyc.ind_aadhaar.status ||
//           user.kyc.ind_driving_license.status ||
//           user.kyc.face.status
//       )
//     ) {
//       user.kyc.overallStatus = "failed";
//       user.isKYCVerified = false;
//     } else if (
//       ["pending"].includes(
//         user.kyc.ind_pan.status ||
//           user.kyc.ind_aadhaar.status ||
//           user.kyc.ind_driving_license.status ||
//           user.kyc.face.status
//       )
//     ) {
//       user.kyc.overallStatus = "pending";
//       user.isKYCVerified = false;
//     } else {
//       user.kyc.overallStatus = "not_started";
//       user.isKYCVerified = false;
//     }

//     await user.save();
//     logger.info(
//       { userId: user._id, overallStatus: user.kyc.overallStatus },
//       "[WEBHOOK] 👤 User KYC updated"
//     );

//     return res.status(200).json({ success: true });
//   } catch (error: any) {
//     logger.error(
//       { error: error.message, stack: error.stack },
//       "[WEBHOOK] ❌ Error processing webhook"
//     );
//     return res.status(500).json({ message: "Internal Server Error" });
//   }
// };

// Put this in your controller file (replace existing idfyWebhook)
export const idfyWebhook = async (req: AuthRequest, res: Response) => {
  const payload = req.body;
  logger.info({ payload }, "[WEBHOOK] 🔔 Received IDfy Webhook");

  const { request_id, task_id, group_id, status, result, type } = payload;
  if (!request_id || !group_id) {
    logger.warn("[WEBHOOK] ⚠️ Missing request_id or group_id");
    return res.status(400).json({ message: "Invalid webhook payload" });
  }

  // Normalize incoming status
  const finalStatus = (status || "").toLowerCase();

  // robust live check helper
  const isLiveFromResult = (r: any) =>
    !!(
      r?.is_live ||
      r?.result?.is_live ||
      r?.output?.is_live ||
      r?.face?.is_live
    );

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 1) Update or upsert the KycTask atomically, but capture the pre-update state
    //    Use findOne to inspect existing task first (no full upsert).
    let task = await KycTask.findOne({ requestId: request_id }).session(
      session
    );

    // logger.info("task => " + task);

    if (!task) {
      // Nothing found by requestId — try to find by group + task id fallback (optional)
      task = await KycTask.findOne({
        groupId: group_id,
        taskId: task_id,
      }).session(session);
    }

    if (!task) {
      // If you want to create a task record on missing, you can upsert.
      // For now we ack and return 200 to not break IDfy retries.
      logger.warn(
        { request_id, group_id },
        "[WEBHOOK] ⚠️ KycTask not found - acknowledged"
      );
      await session.commitTransaction();
      return res.status(200).json({ message: "Task not found, acknowledged" });
    }

    // If task is already completed and incoming is also 'completed', treat as duplicate
    if (
      task.status === "completed" &&
      ["completed", "success"].includes(finalStatus)
    ) {
      logger.info(
        { request_id },
        "[WEBHOOK] Duplicate verified webhook ignored"
      );
      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Duplicate verified webhook ignored" });
    }

    // compute taskStatus value to store
    const newTaskStatus = finalStatus || task.status || "completed";

    // update KycTask
    task.taskId = task_id ?? task.taskId;
    task.status = newTaskStatus;
    task.result = result || task.result;
    task.updatedAt = new Date();
    task.requestId = request_id;
    await task.save({ session });

    logger.info(
      { taskId: task._id, taskType: task.taskType },
      "[WEBHOOK] ✅ KycTask updated"
    );

    // 2) Update User KYC atomically, but avoid downgrading verified fields
    const kycField = task.taskType || type; // prefer stored taskType but fallback to payload.type
    if (
      !["face", "ind_pan", "ind_aadhaar", "ind_driving_license"].includes(
        kycField
      )
    ) {
      logger.warn({ kycField }, "[WEBHOOK] ⚠️ Unknown kycField");
      // commit and ack
      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Unknown kyc type, acknowledged" });
    }

    // Determine the new subdoc status (handle face liveness)
    let newSubdocStatus: "pending" | "verified" | "failed" | "not_provided" =
      "pending";
    if (["completed", "success"].includes(finalStatus)) {
      if (kycField === "face") {
        const live = isLiveFromResult(result);
        newSubdocStatus = live ? "verified" : "failed";
      } else {
        newSubdocStatus = "verified";
      }
    } else if (finalStatus === "failed") {
      newSubdocStatus = "failed";
    } else {
      newSubdocStatus = "pending";
    }

    // Fetch the user doc (with session)
    const user = await User.findOne({ "kyc.groupId": group_id }).session(
      session
    );
    if (!user) {
      logger.warn({ group_id }, "[WEBHOOK] ⚠️ No user found for groupId");
      await session.commitTransaction();
      return res.status(200).json({ message: "User not found" });
    }

    // Skip downgrading: if existing is 'verified' and newSubdocStatus is not 'verified', ignore change
    const existing = user.kyc?.[kycField];
    if (
      existing &&
      existing.status === "verified" &&
      newSubdocStatus !== "verified"
    ) {
      logger.info(
        { userId: user._id, kycField },
        "[WEBHOOK] Ignoring downgrade of verified subdoc"
      );
      // still update KycTask already done — proceed to recompute overall using current kyc
    } else {
      // Apply subdoc update
      user.kyc[kycField] = user.kyc[kycField] || { status: "not_provided" };
      user.kyc[kycField].status = newSubdocStatus;
      user.kyc[kycField].requestId = request_id;
    }

    user.kyc.groupId = group_id; // keep group id in sync
    user.kyc.updatedAt = new Date();

    // Recompute overall status with the rule:
    // overall = verified IF (ind_pan OR ind_aadhaar) AND face AND (no dl provided OR dl verified)
    const panVerified = user.kyc.ind_pan?.status === "verified";
    const aadhaarVerified = user.kyc.ind_aadhaar?.status === "verified";
    const faceVerified = user.kyc.face?.status === "verified";

    const dlStatus = user.kyc.ind_driving_license?.status ?? "not_provided";
    const dlProvided = dlStatus !== "not_provided";
    const dlVerified = dlStatus === "verified";

    if (
      (panVerified || aadhaarVerified) &&
      faceVerified &&
      (!dlProvided || dlVerified)
    ) {
      user.kyc.overallStatus = "verified";
      user.isKYCVerified = true;
    } else if (
      [
        user.kyc.ind_pan?.status,
        user.kyc.ind_aadhaar?.status,
        user.kyc.ind_driving_license?.status,
        user.kyc.face?.status,
      ].includes("failed")
    ) {
      user.kyc.overallStatus = "failed";
      user.isKYCVerified = false;
    } else if (
      [
        user.kyc.ind_pan?.status,
        user.kyc.ind_aadhaar?.status,
        user.kyc.ind_driving_license?.status,
        user.kyc.face?.status,
      ].includes("pending")
    ) {
      user.kyc.overallStatus = "pending";
      user.isKYCVerified = false;
    } else {
      user.kyc.overallStatus = "not_started";
      user.isKYCVerified = false;
    }

    await user.save({ session });

    await session.commitTransaction();
    logger.info(
      { userId: user._id, overallStatus: user.kyc.overallStatus },
      "[WEBHOOK] 👤 User KYC updated"
    );
    return res.status(200).json({ success: true });
  } catch (err: any) {
    await session.abortTransaction();
    logger.error(
      { error: err?.message, stack: err?.stack, payload },
      "[WEBHOOK] ❌ Error processing webhook"
    );
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession();
  }
};
