import mongoose from 'mongoose';
import { z } from 'zod';

// 🔹 Helper: validate MongoDB ObjectId
const objectId = z.string().refine(val => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

// 🔹 Dimensions schema
const dimensionsSchema = z.object({
  length: z.number().positive('Length must be greater than 0'),
  width: z.number().positive('Width must be greater than 0'),
  height: z.number().positive('Height must be greater than 0'),
  unit: z.enum(['cm', 'inches']),
});

// 🔹 Main schema
export const createConsignmentSchema = z.object({
  body: z.object({
    fromAddressId: objectId,
    toAddressId: objectId,
    weight: z.number().positive('Weight must be greater than 0'),
    weightUnit: z.enum(['kg']),
    dimensions: dimensionsSchema.optional(),
    sendingDate: z.string().refine(
      val => {
        console.log('VALIDATING DATE:', val);
        return /^\d{4}-\d{2}-\d{2}$/.test(val) || !isNaN(new Date(val).getTime());
      },
      {
        message: 'Invalid sendingDate format. Must be YYYY-MM-DD or ISO datetime.',
      },
    ),
    receiverName: z.string().min(2, 'Receiver name is required'),
    receiverPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
    category: z.enum(['document', 'non-document']),
    subCategory: z.string().optional(),
    description: z.string().min(5, 'Description must be at least 5 characters'),
    handleWithCare: z.boolean(),
    // images: z.array(z.url("Each image must be a valid URL")).optional(),
    images: z.array(z.string()).optional(),
  }),
});

// ✅ Inferred Type
export type CreateConsignmentInput = z.infer<typeof createConsignmentSchema>['body'];
