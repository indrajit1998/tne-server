import type { Request, Response, NextFunction } from "express";
import ApiError from "../lib/ApiError";

function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.error,
      details: err.details || null,
    });
  }

  return res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
}

export default errorHandler;
