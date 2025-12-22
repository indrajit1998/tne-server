import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { CODES } from '../constants/statusCodes';
import sendResponse from '../lib/ApiResponse';

export const signedUrlRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: any) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return ipKeyGenerator(req);
  },

  handler: (_req, res) => {
    return res
      .status(CODES.TOO_MANY_REQUESTS)
      .json(
        sendResponse(CODES.TOO_MANY_REQUESTS, null, 'Too many image requests. Please slow down.'),
      );
  },
});
