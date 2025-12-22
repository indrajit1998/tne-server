import type { Response } from 'express';
import type { AuthRequest } from '../../middlewares/authMiddleware';
import { CODES } from '../../constants/statusCodes';
import { s3 } from '../../lib/s3';
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import env from '../../lib/env';
import sendResponse from '../../lib/ApiResponse';
import logger from '../../lib/logger';
import ConsignmentModel from '../../models/consignment.model';
import mongoose from 'mongoose';
import { User } from '../../models/user.model';
import { MAX_IMAGE_SIZE_BYTES } from '../../constants/constant';

export const finalizeConsignmentImages = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.user;
    const { consignmentId, tempKeys } = req.body;

    if (!userId || !consignmentId || !Array.isArray(tempKeys)) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'Invalid request payload'));
    }

    const consignment = await ConsignmentModel.findOne({
      _id: consignmentId,
      senderId: userId,
    }).session(session);

    if (!consignment) {
      return res
        .status(CODES.FORBIDDEN)
        .json(sendResponse(CODES.FORBIDDEN, null, 'Not authorized'));
    }

    logger.info(
      '[FINALIZE] Incoming' +
        {
          consignmentId,
          tempKeys,
          userId,
        },
    );

    if (consignment.images.length + tempKeys.length > 3) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'Max 3 images allowed'));
    }

    const finalKeys: string[] = [];

    session.startTransaction();

    for (let i = 0; i < tempKeys.length; i++) {
      const tempKey = tempKeys[i];

      if (!tempKey.startsWith(`temp/${userId}/`)) {
        throw new Error('Invalid temp key ownership');
      }

      // SIZE & MIME VALIDATION
      const head = await s3.send(
        new HeadObjectCommand({
          Bucket: env.AWS_S3_BUCKET_NAME,
          Key: tempKey,
        }),
      );

      if (!head.ContentLength || head.ContentLength > MAX_IMAGE_SIZE_BYTES) {
        // cleanup invalid upload
        await s3.send(
          new DeleteObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: tempKey,
          }),
        );

        throw new Error('Image size exceeds limit');
      }

      if (head.ContentType !== 'image/webp') {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: tempKey,
          }),
        );

        throw new Error('Invalid image type (only webp allowed)');
      }

      const finalKey = `consignments/${consignmentId}/img-${Date.now()}-${i}.webp`;

      await s3.send(
        new CopyObjectCommand({
          Bucket: env.AWS_S3_BUCKET_NAME,
          CopySource: `${env.AWS_S3_BUCKET_NAME}/${tempKey}`,
          Key: finalKey,
          ContentType: 'image/webp',
        }),
      );

      await s3.send(
        new DeleteObjectCommand({
          Bucket: env.AWS_S3_BUCKET_NAME,
          Key: tempKey,
        }),
      );

      finalKeys.push(finalKey);
    }

    // DB UPDATE
    consignment.images.push(...finalKeys);
    await consignment.save({ session });

    await session.commitTransaction();

    return res.status(CODES.OK).json(
      sendResponse(
        CODES.OK,
        {
          images: finalKeys,
        },
        'Consignment images finalized',
      ),
    );
  } catch (error) {
    await session.abortTransaction();
    logger.error('[UPLOAD] Finalize failed' + error);

    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, 'Finalize failed'));
  } finally {
    session.endSession();
  }
};

export const finalizeProfilePicture = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    const { key } = req.body;

    if (!userId || !key) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'Invalid request'));
    }

    // Ownership check
    if (!key.startsWith(`users/${userId}/`)) {
      return res
        .status(CODES.FORBIDDEN)
        .json(sendResponse(CODES.FORBIDDEN, null, 'Invalid file key'));
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, 'User not found'));
    }

    // cleanup: delete old profile picture
    if (
      user.profilePictureUrl &&
      user.profilePictureUrl !== key &&
      !user.profilePictureUrl.startsWith('http') &&
      user.profilePictureUrl.startsWith('users/')
    ) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: user.profilePictureUrl,
          }),
        );
      } catch (err) {
        // non-fatal
        logger.warn('[UPLOAD] Failed to delete old profile pic' + err);
      }
    }

    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: key,
      }),
    );

    if (!head.ContentLength || head.ContentLength > MAX_IMAGE_SIZE_BYTES) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: env.AWS_S3_BUCKET_NAME,
          Key: key,
        }),
      );

      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'Profile image too large'));
    }
    if (head.ContentType !== 'image/webp') {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: env.AWS_S3_BUCKET_NAME,
          Key: key,
        }),
      );

      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, 'Invalid image type (only webp allowed)'));
    }

    //  DB UPDATE
    user.profilePictureUrl = key;
    await user.save();

    logger.info(
      '[UPLOAD] Profile picture updated' +
        {
          userId,
          key,
        },
    );

    return res.status(CODES.OK).json(
      sendResponse(
        CODES.OK,
        {
          profilePictureUrl: key,
        },
        'Profile picture updated',
      ),
    );
  } catch (error) {
    logger.error('[UPLOAD] Profile finalize failed' + error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, 'Failed to update profile picture'));
  }
};
