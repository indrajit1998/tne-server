import express from "express";
import { generateOtp, registerUser, verifyOtp } from "../../controllers/UserController/userController";


const app=express()

app.post("/generateOtp",generateOtp)

app.get("/verifyOtp",verifyOtp)

app.post("/registerUser",registerUser)


export default app;