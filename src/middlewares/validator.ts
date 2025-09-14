import {z} from "zod"
import { ZodObject } from "zod";
import type { Request, Response, NextFunction } from "express";

const phoneSchema=z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number");

const emailSchema = z.string().email("Invalid email address");


/**
 * Middleware to validate request body using Zod schema
 * @param schema - Zod object schema
 */
 const validate = (schema: ZodObject<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate request body
      schema.parse(req.body);
      next();
    } catch (err: any) {
      // Extract Zod error messages
      const errors = err.errors?.map((e: any) => ({
        path: e.path.join("."),
        message: e.message,
      }));

      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }
  };
};


export { phoneSchema, emailSchema, validate }