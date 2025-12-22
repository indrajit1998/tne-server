import env from '../lib/env';
import { Types } from 'mongoose';

const cookiesOption = {
  httpOnly: true,
  secure: env.NODE_ENV === 'development' ? false : true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const SENDER_RATING_WINDOW_DAYS = 7;

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export { cookiesOption, SENDER_RATING_WINDOW_DAYS, ALLOWED_TYPES, MAX_IMAGE_SIZE_BYTES };
