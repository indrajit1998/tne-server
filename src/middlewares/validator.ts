import {z} from "zod"


const phoneSchema=z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number");

const emailSchema = z.string().email("Invalid email address");

export {phoneSchema,emailSchema}