import { Router } from "express";
import {
  fetchAddressFromCoordinates,
  getDistanceBetweenPoints,
  getLocationDetails,
  getSuggestions,
} from "../../controllers/location.controller";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const locationRouter = Router();

locationRouter.use(isAuthMiddleware);

locationRouter.get("/suggestions", getSuggestions);
locationRouter.get("/details", getLocationDetails);
locationRouter.get("/address", fetchAddressFromCoordinates);
locationRouter.get("/distance", getDistanceBetweenPoints);

export default locationRouter;
