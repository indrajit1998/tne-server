import { Router } from "express";
import {
  getLocationDetails,
  getSuggestions,
} from "../../controllers/location.controller";

const locationRouter = Router();

locationRouter.get("/suggestions", getSuggestions);
locationRouter.get("/details", getLocationDetails);

export default locationRouter;
