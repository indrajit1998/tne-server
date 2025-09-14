import { Router } from "express";
import isAuthMiddleware from "../../middlewares/authMiddleware";
import { addAddress } from "../../controllers/address.controller";

const addressRouter = Router();

addressRouter.post("/create", isAuthMiddleware, addAddress);

export default addressRouter;