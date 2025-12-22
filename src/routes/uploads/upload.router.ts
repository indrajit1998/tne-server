import { Router } from 'express';
import authMiddleware from '../../middlewares/authMiddleware';
import {
  getPresignedUploadUrl,
  getSignedGetUrl,
} from '../../controllers/uploads/upload.controller';
import {
  finalizeConsignmentImages,
  finalizeProfilePicture,
} from '../../controllers/uploads/finalize.controller';
import { uploadRateLimiter } from '../../middlewares/uploadRatelimiter';
import { signedUrlRateLimiter } from '../../middlewares/signedUrlRatelimiter';

const uploadRouter = Router();

// generate presigned PUT URL (upload permission)
uploadRouter.post('/presigned-url', authMiddleware, uploadRateLimiter, getPresignedUploadUrl);

// Finalize consignment images (temp → final + DB update)
uploadRouter.post('/finalize-consignment-images', authMiddleware, finalizeConsignmentImages);

//Finalize profile picture (DB update)
uploadRouter.post('/finalize-profile-picture', authMiddleware, finalizeProfilePicture);

// Generate signed GET URL (view permission)
uploadRouter.get('/signed-url', authMiddleware, signedUrlRateLimiter, getSignedGetUrl);

export default uploadRouter;
