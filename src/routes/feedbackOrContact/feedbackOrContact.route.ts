import { Router } from "express";
import { postFeedbackOrContact } from "../../controllers/feedbackOrContact/feedbackOrContact";
import isAuthMiddleware from "../../middlewares/authMiddleware";

const feedbackOrContactRoute = Router();

feedbackOrContactRoute.post(
  "/postFeedbackOrContact",
  isAuthMiddleware,
  postFeedbackOrContact
);

export default feedbackOrContactRoute;
