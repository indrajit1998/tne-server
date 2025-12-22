import type { Response } from 'express';
import type { AuthRequest } from '../../middlewares/authMiddleware';
import { ALLOWED_TYPES } from '../../constants/constant';
import { v4 as uuid } from 'uuid';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import env from '../../lib/env';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from '../../lib/s3';
import { CODES } from '../../constants/statusCodes';
import logger from '../../lib/logger';
import sendResponse from '../../lib/ApiResponse';
import { User } from '../../models/user.model';
import ConsignmentModel from '../../models/consignment.model';

export const getPresignedUploadUrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    const { type, contentType, currentCount } = req.body;

    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, 'Unauthorized'));
    }

    if (!type || !contentType) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'type and contentType required'));
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'Invalid image type'));
    }

    let key: string;

    if (type === 'profile') {
      key = `users/${userId}/profile-${Date.now()}.webp`;
    } else if (type === 'consignment') {
      if (typeof currentCount !== 'number') {
        return res
          .status(CODES.BAD_REQUEST)
          .json(sendResponse(CODES.BAD_REQUEST, null, 'currentCount required'));
      }

      if (currentCount >= 3) {
        return res
          .status(CODES.BAD_REQUEST)
          .json(sendResponse(CODES.BAD_REQUEST, null, 'Maximum 3 consignment images allowed'));
      }

      const ext =
        contentType === 'image/webp' ? 'webp' : contentType === 'image/png' ? 'png' : 'jpg';

      key = `temp/${userId}/${uuid()}.${ext}`;
    } else {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'Invalid upload type'));
    }

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    // const publicUrl = `${env.AWS_S3_PUBLIC_URL}/${key}`;

    logger.info(
      `[UPLOAD] Presigned URL generated` +
        {
          userId,
          key,
          type,
        },
    );

    return res
      .status(CODES.OK)
      .json(sendResponse(CODES.OK, { uploadUrl, key }, 'Upload URL generated'));
  } catch (error) {
    logger.error('[UPLOAD] Failed to generate presigned URL' + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, 'Failed to generate upload URL'));
  }
};

// Get signed url to view images

const SIGNED_URL_EXPIRY_SECONDS = 60 * 5; // 5 minutes

export const getSignedGetUrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user; // authenticated user
    const { key } = req.query as { key?: string };

    if (!userId || !key) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'key is required'));
    }

    // --------------------------------------------------
    // CASE 1: Profile picture (any authenticated user)
    // --------------------------------------------------
    if (key.startsWith('users/')) {
      const [, ownerId] = key.split('/');

      const user = await User.findById(ownerId).select('_id profilePictureUrl');

      if (!user || user.profilePictureUrl !== key) {
        return res
          .status(CODES.FORBIDDEN)
          .json(sendResponse(CODES.FORBIDDEN, null, 'Invalid profile image access'));
      }
    }

    // --------------------------------------------------
    // CASE 2: Consignment image (search & discovery)
    // --------------------------------------------------
    else if (key.startsWith('consignments/')) {
      const [, consignmentId] = key.split('/');

      if (!consignmentId) {
        return res
          .status(CODES.BAD_REQUEST)
          .json(sendResponse(CODES.BAD_REQUEST, null, 'Invalid key'));
      }

      const consignment = await ConsignmentModel.findById(consignmentId).select('images');

      if (!consignment) {
        return res
          .status(CODES.NOT_FOUND)
          .json(sendResponse(CODES.NOT_FOUND, null, 'Consignment not found'));
      }

      if (!consignment.images.includes(key)) {
        return res
          .status(CODES.FORBIDDEN)
          .json(sendResponse(CODES.FORBIDDEN, null, 'Image not part of consignment'));
      }
    }

    // --------------------------------------------------
    // CASE 3: Anything else → deny
    // --------------------------------------------------
    else {
      return res
        .status(CODES.FORBIDDEN)
        .json(sendResponse(CODES.FORBIDDEN, null, 'Invalid file access'));
    }

    // --------------------------------------------------
    // Generate signed GET URL
    // --------------------------------------------------
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: SIGNED_URL_EXPIRY_SECONDS,
    });

    logger.info(
      '[UPLOAD] Signed GET URL generated' +
        {
          requestedBy: userId,
          key,
        },
    );

    return res
      .status(CODES.OK)
      .json(
        sendResponse(
          CODES.OK,
          { url: signedUrl, expiresIn: SIGNED_URL_EXPIRY_SECONDS },
          'Signed URL generated',
        ),
      );
  } catch (error) {
    logger.error('[UPLOAD] Signed GET URL failed' + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, 'Failed to generate signed URL'));
  }
};
