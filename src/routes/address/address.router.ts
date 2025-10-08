import { Router } from "express";
import {
  addAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from "../../controllers/address.controller";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const addressRouter = Router();

addressRouter.post("/create", isAuthMiddleware, addAddress);
addressRouter.get("/getAddresses", isAuthMiddleware, getAddresses);
addressRouter.put("/update/:id", isAuthMiddleware, updateAddress);
addressRouter.delete("/delete/:id", isAuthMiddleware, deleteAddress);

export default addressRouter;
