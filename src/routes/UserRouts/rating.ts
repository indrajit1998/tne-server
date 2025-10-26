import { Router } from "express";

import {
  canRateConsignment,
  checkIfRated,
  createRating,
  getTravellerRatings,
} from "../../controllers/UserController/ratingController";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const ratingRouter = Router();

// Create a new rating
ratingRouter.post("/create", isAuthMiddleware, createRating);

// Check if user has already rated a specific consignment
ratingRouter.get("/check/:travelConsignmentId", isAuthMiddleware, checkIfRated);

// Check if user can rate (status + time validation)
ratingRouter.get(
  "/can-rate/:travelConsignmentId",
  isAuthMiddleware,
  canRateConsignment
);

// Get all ratings for a traveller
ratingRouter.get(
  "/traveller/:travellerId",
  isAuthMiddleware,
  getTravellerRatings
);

export default ratingRouter;
