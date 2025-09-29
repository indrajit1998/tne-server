import { Router } from "express";
import isAuthMiddleware from "../../middlewares/authMiddleware";
import { addAddress, getAddresses } from "../../controllers/address.controller";

const addressRouter = Router();

addressRouter.post("/create", isAuthMiddleware, addAddress);
addressRouter.get("/getAddresses", isAuthMiddleware, getAddresses);

export default addressRouter;