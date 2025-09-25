import { Router } from "express";
import {
  generateOtp,
  registerUser,
  verifyOtp,
} from "../../controllers/UserController/userController";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const authRouter = Router();

authRouter.post("/generateOtp", generateOtp);
authRouter.post("/verifyOtp", verifyOtp);
authRouter.post("/registerUser", isAuthMiddleware, registerUser);


export default authRouter;
