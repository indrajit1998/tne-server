import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { CODES } from '../constants/statusCodes';
import sendResponse from '../lib/ApiResponse';

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: any) => {
    // Prefer authenticated user
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    // Fallback to IPv6-safe IP key
    return ipKeyGenerator(req);
  },

  handler: (_req, res) => {
    return res
      .status(CODES.TOO_MANY_REQUESTS)
      .json(
        sendResponse(
          CODES.TOO_MANY_REQUESTS,
          null,
          'Too many upload attempts. Please try again later.',
        ),
      );
  },
});
