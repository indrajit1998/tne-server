import { Router } from "express";

import { validate } from "../../../validator";
import {
  createTravel,
  getTravels,
  locateTravel,
  locateTravelbyid,
} from "../../controllers/UserController/travel";
import isAuthMiddleware from "../../middlewares/authMiddleware";
import { createTravelSchema } from "../../middlewares/travel.validator";

const travelRouter = Router();
travelRouter.post(
  "/createTravel",
  isAuthMiddleware,
  validate(createTravelSchema),
  createTravel
);
travelRouter.get("/getTravels", isAuthMiddleware, getTravels);
travelRouter.get("/locateTravel", isAuthMiddleware, locateTravel);
travelRouter.get("/locateTravelByid/:id", isAuthMiddleware, locateTravelbyid);
export default travelRouter;
