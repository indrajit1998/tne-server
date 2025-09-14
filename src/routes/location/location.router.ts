import { Router } from "express";
import {
  fetchAddressFromCoordinates,
  getDistanceBetweenPoints,
  getLocationDetails,
  getSuggestions,
} from "../../controllers/location.controller";

const locationRouter = Router();

locationRouter.get("/suggestions", getSuggestions);
locationRouter.get("/details", getLocationDetails);
locationRouter.get("/address", fetchAddressFromCoordinates);
locationRouter.get("/distance", getDistanceBetweenPoints);

export default locationRouter;
