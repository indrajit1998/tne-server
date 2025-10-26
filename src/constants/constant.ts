import env from "../lib/env";
import { Types } from "mongoose";

const cookiesOption = {
  httpOnly: true,
  secure: env.NODE_ENV === "development" ? false : true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const SENDER_RATING_WINDOW_DAYS = 7;

export { cookiesOption, SENDER_RATING_WINDOW_DAYS };
