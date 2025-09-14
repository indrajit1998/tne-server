import { Router } from "express";
import {
  createConsignment,
  getConsignments,
  locateConsignment,
  locateConsignmentById,
} from "../../controllers/Consignment/consignment";
import isAuthMiddleware from "../../middlewares/authMiddleware";
import { validate } from "../../middlewares/validator";
import { createConsignmentSchema } from "../../middlewares/consignment.validator";

const consignmentRouter = Router();

consignmentRouter.post(
  "/createConsignment",
  isAuthMiddleware,
  validate(createConsignmentSchema),
  createConsignment
);
consignmentRouter.get("/getConsignments", isAuthMiddleware, getConsignments);
consignmentRouter.get(
  "/locateConsignment",
  isAuthMiddleware,
  locateConsignment
);
consignmentRouter.get(
  "/locateConsignmentByid/:id",
  isAuthMiddleware,
  locateConsignmentById
);

export default consignmentRouter;
