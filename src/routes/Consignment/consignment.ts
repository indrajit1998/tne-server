import { Router } from "express";
import {
  acceptCarryRequest,
  carryRequestBySender,
  carryRequestByTraveller,
  createConsignment,
  getConsignments,
  locateConsignment,
  locateConsignmentById,
  rejectCarryRequest,
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

consignmentRouter.post("/carryRequestBySender",isAuthMiddleware,carryRequestBySender);
consignmentRouter.post("/carryRequestByTraveller",isAuthMiddleware,carryRequestByTraveller);
consignmentRouter.patch("/acceptCarryRequest",isAuthMiddleware,acceptCarryRequest);
consignmentRouter.patch("/rejectCarryRequest",isAuthMiddleware,rejectCarryRequest);



export default consignmentRouter;
