import type { Response } from 'express';
import type { Types } from 'mongoose';
import mongoose from 'mongoose';
import logger from '../../lib/logger';
import type { AuthRequest } from '../../middlewares/authMiddleware';
import { KycTask } from '../../models/kycTask.model';
import { User } from '../../models/user.model';
import { cashfreePost, cashfreeGet } from '../../services/cashfree.service';

/**
 * Helper — create KycTask document
 */
async function createKycTaskRecord(params: {
  userId: Types.ObjectId;
  taskType: string;
  taskId?: string;
  requestId?: string;
  initialStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  raw?: any;
}) {
  const { userId, taskType, taskId, requestId, initialStatus = 'pending', raw } = params;
  const task = await KycTask.create({
    userId,
    taskType,
    taskId,
    requestId,
    status: initialStatus,
    result: raw ? { meta: raw } : undefined,
  });
  return task;
}

/**
 * GET /api/v1/kyc/url
 */
export const startAadhaarKyc = async (req: AuthRequest, res: Response) => {
  const userId = req.user;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const type = 'ind_aadhaar';

  try {
    // Call Cashfree to get the URL for OTP-based Aadhaar EKYC
    const verificationId = `AADHAAR_${new Date().getTime()}`; // unique id for this verification
    const opts = {
      "verification_id": verificationId,
      "document_requested": [
        "AADHAAR"
       ],
      "redirect_url": "",
      "user_flow": "signup"
    };

    const response = await cashfreePost('/verification/digilocker', opts);

    // Persist KycTask
    await createKycTaskRecord({
      userId: new mongoose.Types.ObjectId(typeof userId === 'string' ? userId : userId._id),
      taskType: 'ind_aadhaar',
      taskId: verificationId,
      requestId: response.reference_id,
      initialStatus: 'pending',
      raw: response,
    });

    // Update user's kyc subdoc: set requestId and status -> pending, set groupId
    const update: any = {
      'kyc.groupId': '',
      [`kyc.${type}.requestId`]: response.reference_id,
      [`kyc.${type}.status`]: 'pending',
      'kyc.overallStatus': 'pending',
      'kyc.updatedAt': new Date(),
    };

    await User.findByIdAndUpdate(userId, { $set: update });

    logger.info(
      { userId, type, taskId: verificationId, requestId: response.reference_id },
      'KYC document verification started',
    );

    return res.status(200).json({
      message: 'kyc_verification_started',
      type,
      ekycUrl: response.url,
      requestId: response.reference_id,
    });
  } catch (err: any) {
    logger.error({ err, body: req.body, userId }, 'startDocumentVerification failed');
    return res.status(500).json({
      message: 'Failed to start document verification',
      error: err?.message || 'internal_error',
    });
  }
};


/**
 * GET /api/v1/kyc/status
 * Returns user's Aadhaar KYC and isKYCVerified flag
 */
export const getKycStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const user = await User.findById(userId).select(
      'kyc isKYCVerified firstName lastName phoneNumber',
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({
      kyc: user.kyc || {},
      isKYCVerified: user.isKYCVerified || false,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
    });
  } catch (err: any) {
    logger.error({ err, userId }, 'getKycStatus failed');
    return res.status(500).json({ message: 'Internal server error' });
  }
};


/**
 * POST /api/v1/kyc/fetch-result
 * Optional admin/debug endpoint to manually fetch a task result from Cashfree using verfification and reference id
 */
export const getAadhaarKycStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const userTasks: any = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(typeof userId === 'string' ? userId : userId._id),
        },
      },
      {
        $lookup: {
          from: 'kyctasks',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$status', 'pending'] },
                  ],
                },
              },
            },
            {
              $sort: {
                createdAt: -1,
              },
            },
            {
              $limit: 1,
            },
            {
              $project: {
                taskId: 1,
                requestId: 1,
                status: 1,
              },
            },
          ],
          as: 'kycTask',
        },
      },
      {
        $unwind: {
          path: '$kycTask',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          kyc: 1,
          isKYCVerified: 1,
          firstName: 1,
          lastName: 1,
          phoneNumber: 1,
          kycTask: 1,
        },
      },
    ]);

    if (userTasks && userTasks.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = userTasks[0]; // aggregate returns an array
    if (user.kycTask && (!user.kycTask.requestId || !user.kycTask.taskId )) {
      return res.status(400).json({ message: 'Aadhaar EKYC request is not initialized' });
    }

    const resp = await fetchTaskResult(user.kycTask.requestId, user.kycTask.taskId);
    // resp is the Cashfree GET response (array or object depending on API)
    const userUpdate = await User.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(typeof userId === 'string' ? userId : userId._id) },
      {
        $set: {
          isKYCVerified: resp.status === 'SUCCESS',
          'kyc.ind_aadhaar.status': resp.status == 'SUCCESS' ? 'verified' : 'pending',
          'kyc.ind_aadhaar.name': resp.name,
          'kyc.ind_aadhaar.dob': resp.dob,
          'kyc.ind_aadhaar.gender': resp.gender,
          'kyc.overallStatus': resp.status === 'SUCCESS' ? 'verified' : 'pending',
          'kyc.updatedAt': new Date(),
        },
      }
    );
    await KycTask.updateOne(
      { userId: new mongoose.Types.ObjectId(typeof userId === 'string' ? userId : userId._id), taskId: user.kycTask.taskId, requestId: user.kycTask.requestId },
      {
        $set: {
          status: userUpdate?.isKYCVerified ? 'completed' : 'pending',
        },
      }
    );
    logger.info({ requestId: user.kycTask.requestId, taskId: user.kycTask.taskId, resp }, 'Fetched task result via manual retry');

    return res.status(200).json({
      kyc: userUpdate?.kyc || {},
      isKYCVerified: userUpdate?.isKYCVerified || false,
      firstName: userUpdate?.firstName,
      lastName: userUpdate?.lastName,
      phoneNumber: userUpdate?.phoneNumber,
    });
  } catch (err: any) {
    logger.error({ err, userId }, 'getAadhaarKycStatus failed');
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const fetchTaskResult = async (requestId: string, verification_id: string) => {
  try {
    const response = await cashfreeGet('/verification/digilocker/document/AADHAAR', { reference_id: requestId, verification_id: verification_id });
    logger.info({ requestId, taskId: verification_id, status: response.status }, '[CASHFREE] ✅ Fetched Task Result');
    // return {
    //   "reference_id": 408,
    //   "verification_id": "test001",
    //   "status": "SUCCESS",
    //   "uid": "xxxxxxxx5647",
    //   "care_of": "S/O: Fakkirappa Dollin",
    //   "dob": "02-02-1995",
    //   "gender": "M",
    //   "name": "Mallesh Fakkirappa Dollin",
    //   "photo_link": "/9j/4AAQSkZJRgABAgAAAQABAAD/2wBDAAgGBgcGBQgHB",
    //   "split_address": {
    //     "country": "India",
    //     "dist": "Haveri",
    //     "house": "Shri Kanaka Nilaya",
    //     "landmark": "",
    //     "pincode": "581115",
    //     "po": "Ranebennur",
    //     "state": "Karnataka",
    //     "street": "Umashankar Nagar 1st Main 5th Cross",
    //     "subdist": "Ranibennur",
    //     "vtc": "Ranibennur"
    //   },
    //   "year_of_birth": 2000,
    //   "xml_file": "<xml file link with 48hrs expiry>",
    //   "message": "Aadhaar Card Exists"
    // };
    return response;
  } catch (error) {
    logger.error({ requestId, taskId: verification_id, error }, '[CASHFREE] ❌ Failed to Fetch Task Result');
    throw error;
  }
};

export const cashfreeWebhook = async (req: AuthRequest, res: Response) => {
  const payload = req.body;
  const data = payload && payload.data;
  logger.info({ payload }, '[WEBHOOK] 🔔 Received Cashfree Webhook');

  if (!data.verification_id || !data.reference_id) {
    logger.warn('[WEBHOOK] ⚠️ Missing request_id or group_id');
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  // Normalize incoming status
  const finalStatus = (data.status || '');

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 1) Update or upsert the KycTask atomically, but capture the pre-update state
    //    Use findOne to inspect existing task first (no full upsert).
    let task = await KycTask.findOne({ requestId: data.reference_id, taskId: data.verification_id }).session(session);

    if (!task) {
      // If you want to create a task record on missing, you can upsert.
      // For now we ack and return 200 to not break IDfy retries.
      logger.warn({ requestId: data.reference_id, taskId: data.verification_id }, '[WEBHOOK] ⚠️ KycTask not found - acknowledged');
      await session.commitTransaction();
      return res.status(200).json({ message: 'Task not found, acknowledged' });
    }

    // If task is already completed and incoming is also 'completed', treat as duplicate
    if (task.status === 'completed' && ['completed', 'success'].includes(finalStatus)) {
      logger.info({ requestId: data.reference_id, taskId: data.verification_id }, '[WEBHOOK] Duplicate verified webhook ignored');
      await session.commitTransaction();
      return res.status(200).json({ message: 'Duplicate verified webhook ignored' });
    }

    // update KycTask
    task.status = finalStatus === 'AUTHENTICATED' ? 'completed' : 'pending' ;
    task.updatedAt = new Date();
    await task.save({ session });

    logger.info({ taskId: task.taskId, taskType: task.taskType }, '[WEBHOOK] ✅ KycTask updated');
    // Fetch the user doc (with session)
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(task.userId) }).session(session);
    if (!user) {
      logger.warn({ requestId: data.reference_id, taskId: data.verification_id }, '[WEBHOOK] ⚠️ No user found for task - acknowledged');
      await session.commitTransaction();
      return res.status(200).json({ message: 'User not found' });
    }

    user.isKYCVerified = finalStatus === 'AUTHENTICATED';
    user.kyc.ind_aadhaar.status = finalStatus === 'AUTHENTICATED' ? 'verified' : 'pending';
    user.kyc.ind_aadhaar.name = data.user_details.name;
    user.kyc.ind_aadhaar.dob = data.user_details.dob;
    user.kyc.ind_aadhaar.gender = data.user_details.gender;
    user.kyc.overallStatus = finalStatus === 'AUTHENTICATED' ? 'verified' : 'pending';
    user.kyc.updatedAt = new Date();

    await user.save({ session });
    await session.commitTransaction();
    logger.info(
      {   userId: task.userId, overallStatus: user?.kyc?.overallStatus, isKYCVerified: user?.isKYCVerified },
        '[WEBHOOK] 👤 User KYC updated',
    );
    return res.status(200).json({ success: true });
  } catch (err: any) {
    await session.abortTransaction();
    logger.error(
      { error: err?.message, stack: err?.stack, payload },
      '[WEBHOOK] ❌ Error processing webhook',
    );
    return res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    session.endSession();
  }
};