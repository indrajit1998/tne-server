

import express from "express";
import { createConsignment, getConsignments, locateConsignment, locateConsignmentById } from "../../controllers/Consignment/consignment";
import isAuthMiddleware from "../../middlewares/authMiddleware";
import { validate } from "../../middlewares/validator";
import { createConsignmentSchema } from "../../middlewares/consignment.validator";


const app = express();
app.use(isAuthMiddleware);

app.post("/createConsignment",validate(createConsignmentSchema), createConsignment);
app.get("/getConsignments", getConsignments);
app.get("/locateConsignment",locateConsignment)
app.get("/locateConsignmentByid/:id",locateConsignmentById)

export default app;