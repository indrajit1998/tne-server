import { z, ZodObject, ZodError } from "zod";
import type { Request, Response, NextFunction } from "express";

// Common reusable schemas
const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number");
const emailSchema = z.string().email("Invalid email address");

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

export { phoneSchema, emailSchema, validate };
