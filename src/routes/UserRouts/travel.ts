import { Router } from "express";

import { validate } from "../../../validator";
import {
  cancelTravel,
  createTravel,
  endTravel,
  getTravels,
  locateTravel,
  locateTravelbyid,
  startTravel,
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
travelRouter.post("/:travelId/start", isAuthMiddleware, startTravel);
travelRouter.post("/:travelId/end", isAuthMiddleware, endTravel);
travelRouter.post("/:travelId/cancel", isAuthMiddleware, cancelTravel);

export default travelRouter;
