import { model, Schema, type Types } from "mongoose";

interface Travel {
  travelerId: Types.ObjectId;
  fromAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  toAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  toCoordinates: {
    type: "Point";
    coordinates: [number, number];
  };
  fromCoordinates: {
    type: "Point";
    coordinates: [number, number];
  };
  expectedStartDate: Date;
  expectedEndDate: Date;
  modeOfTravel: "air" | "roadways" | "train";
  vehicleType?: "car" | "bus" | "other";
  vehicleNumber?: string;
  durationOfStay: {
    days: number;
    hours: number;
  };
  durationOfTravel: string;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  createdAt?: Date;
  updatedAt?: Date;
}

const travelSchema = new Schema<Travel>(
  {
    travelerId: { type: Schema.Types.ObjectId, required: true },
    fromAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    toAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    toCoordinates: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },
    fromCoordinates: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },
    expectedStartDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    modeOfTravel: {
      type: String,
      enum: ["air", "roadways", "train"],
      required: true,
    },
    vehicleType: {
      type: String,
      enum: ["car", "bus", "other"],
      required: false,
    },
    vehicleNumber: { type: String, required: false },
    durationOfStay: {
      days: { type: Number, required: true },
      hours: { type: Number, required: true },
    },
    durationOfTravel: { type: String, required: true },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      required: true,
    },
  },
  { timestamps: true }
);

export const TravelModel = model<Travel>("Travel", travelSchema);
