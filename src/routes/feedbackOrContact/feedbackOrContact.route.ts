import { Router } from "express";
import { postFeedbackOrContact } from "../../controllers/feedbackOrContact/feedbackOrContact";


const feedbackOrContactRoute = Router();

feedbackOrContactRoute.post("/postFeedbackOrContact", postFeedbackOrContact);


export default feedbackOrContactRoute;