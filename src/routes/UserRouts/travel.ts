import express from "express";

import { validate } from "../../middlewares/validator";
import { createTravel, getTravels, locateTravel, locateTravelbyid } from "../../controllers/UserController/travel";
import { createTravelSchema } from "../../middlewares/travel.validator";
import isAuthMiddleware from "../../middlewares/authMiddleware";


const app = express();
app.use(isAuthMiddleware);
app.post("/createTravel", validate(createTravelSchema), createTravel);
app.get("/getTravels", getTravels);
app.get("/locateTravel", locateTravel); 
app.get("/locateTravelByid/:id", locateTravelbyid);
export default app;