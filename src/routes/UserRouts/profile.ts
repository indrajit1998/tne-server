
import expres from "express";

const app=expres()

import getProfile from "../../controllers/UserController/profileController.js";
import isAuthMiddleware from "../../middlewares/authMiddleware.js";
app.use(isAuthMiddleware)

app.get("/getprofile",getProfile)

export default app;