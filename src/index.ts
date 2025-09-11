import express from "express";
import cors from "cors";
import env from "./lib/env";
import logger from "./lib/logger";
import requestLogger from "./middlewares/requestLogger";
import errorHandler from "./middlewares/errorHandler";

const PORT = parseInt(env.PORT, 10);

const app = express();

app.use(cors());
app.use(express.json());

app.use(requestLogger);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
