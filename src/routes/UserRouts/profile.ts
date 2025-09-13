
import expres from "express";

const app=expres()

import{ getProfile, getTravelAndConsignment} from "../../controllers/UserController/profileController.js";
import isAuthMiddleware from "../../middlewares/authMiddleware.js";
import { get } from "mongoose";
app.use(isAuthMiddleware)

app.get("/getprofile",getProfile)
app.get("/getTravelAndConsignment",getTravelAndConsignment)

export default app;