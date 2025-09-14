import express, { Router } from "express";

import { validate } from "../../middlewares/validator";
import {
  createTravel,
  getTravels,
  locateTravel,
  locateTravelbyid,
} from "../../controllers/UserController/travel";
import { createTravelSchema } from "../../middlewares/travel.validator";
import isAuthMiddleware from "../../middlewares/authMiddleware";

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
