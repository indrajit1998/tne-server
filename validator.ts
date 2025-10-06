import type { NextFunction, Request, Response } from "express";
import { z, ZodError, ZodObject } from "zod";

// Common reusable schemas
const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, "Invalid Indian phone number");

const emailSchema = z.string().email().optional().nullable();

/**
 * Middleware to validate request data (body, query, params) using a Zod schema
 * @param schema - Zod object schema
 */
const validate =
  (schema: ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        return res.status(400).json({
          message: "Validation error",
          errors,
        });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  };

export { emailSchema, phoneSchema, validate };
