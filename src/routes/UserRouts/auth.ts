import express from "express";
import { generateOtp, registerUser, verifyOtp } from "../../controllers/UserController/userController";
import isAuthMiddleware from "../../middlewares/authMiddleware";


const app=express()

app.post("/generateOtp",generateOtp)

app.get("/verifyOtp",verifyOtp)
app.use(isAuthMiddleware)

app.post("/registerUser",registerUser)


export default app;