

import express from "express";
import { createConsignment } from "../../controllers/Consignment/consignment";


const app = express();

app.post("/createConsignment",createConsignment)

export default app;