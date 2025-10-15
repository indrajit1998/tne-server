import { Router } from "express";

import {
  getTravelConsignmentById,
  getTravelConsignments,
} from "../../controllers/TravelConsignment/travelConsignment.controller";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const travelConsignmentRouter = Router();

travelConsignmentRouter.get(
  "/getTravelConsignmentById/:travelConsignmentId",
  isAuthMiddleware,
  getTravelConsignmentById
);
travelConsignmentRouter.get(
  "/getTravelConsignments",
  isAuthMiddleware,
  getTravelConsignments
);

export default travelConsignmentRouter;
