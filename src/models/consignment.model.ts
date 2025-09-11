import { model, Schema, type Types } from "mongoose";

interface Consignment {
  senderId: Types.ObjectId;
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

  weight: number;
  weightUnit: "kg" | "gram" | "lb";
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "m" | "inches";
  };
  sendingDate: Date;
  receiverName: string;
  receiverPhone: string;
  category: "document" | "non-document";
  subCategory?: string;
  description: string;
  handleWithCare: boolean;
  images: string[];
  status:
    | "published"
    | "requested"
    | "in-transit"
    | "delivered"
    | "cancelled"
    | "assigned";
  createdAt?: Date;
  updatedAt?: Date;
}

const consignmentSchema = new Schema<Consignment>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    fromCoordinates: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    weight: {
      type: Number,
      required: true,
    },
    weightUnit: {
      type: String,
      enum: ["kg", "gram", "lb"],
      required: true,
    },
    dimensions: {
      length: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      unit: {
        type: String,
        enum: ["cm", "m", "inches"],
        required: true,
      },
    },
    sendingDate: {
      type: Date,
      required: true,
    },
    receiverName: {
      type: String,
      required: true,
    },
    receiverPhone: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["document", "non-document"],
      required: true,
    },
    subCategory: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    handleWithCare: {
      type: Boolean,
      required: true,
      default: false,
    },
    images: {
      type: [String],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "published",
        "requested",
        "in-transit",
        "delivered",
        "cancelled",
        "assigned",
      ],
      required: true,
    },
  },
  { timestamps: true }
);

const ConsignmentModel = model<Consignment>("Consignment", consignmentSchema);

export default ConsignmentModel;
