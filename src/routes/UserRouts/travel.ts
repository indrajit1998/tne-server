import express from "express";

import { validate } from "../../middlewares/validator";
import { createTravel } from "../../controllers/UserController/travel";
import { createTravelSchema } from "../../middlewares/travel.validator";


const app = express();


app.post("/createTravel",validate(createTravelSchema),createTravel)


export default app;