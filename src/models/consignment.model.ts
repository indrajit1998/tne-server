import { model, Schema, type Types } from "mongoose";

interface Consignment {
  senderId: Types.ObjectId;
  fromAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    flatNo: string;
    landmark: string;
  };
  toAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    flatNo: string;
    landmark?: string;
  };
  toCoordinates: {
    type: "Point";
    coordinates: [number, number];
  };
  fromCoordinates: {
    type: "Point";
    coordinates: [number, number];
  };
  distance: string;
  weight: number;
  weightUnit: "kg" | "gram" | "lb";
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "m" | "inches";
  };
  flightPrice: {
    senderPay: number;
    travelerEarn: number;
  };
  trainPrice: {
    senderPay: number;
    travelerEarn: number;
  };
  roadWaysPrice: {
    senderPay: number;
    travelerEarn: number;
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
    | "assigned"
    | "to_handover"
    | "in-transit"
    | "delivered"
    | "cancelled"
    | "expired";
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
      flatNo: { type: String, required: true },
      landmark: { type: String, required: false },
    },
    toAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      flatNo: { type: String, required: true },
      landmark: { type: String, required: false },
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
    distance: {
      type: String,
      required: true,
    },
    weight: {
      type: Number,
      required: true,
    },
    flightPrice: {
      senderPay: { type: Number, required: true },
      travelerEarn: { type: Number, required: true },
    },
    trainPrice: {
      senderPay: { type: Number, required: true },
      travelerEarn: { type: Number, required: true },
    },
    roadWaysPrice: {
      senderPay: { type: Number, required: true },
      travelerEarn: { type: Number, required: true },
    },
    weightUnit: {
      type: String,
      enum: ["kg"],
      required: true,
    },
    dimensions: {
      length: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      unit: {
        type: String,
        enum: ["cm", "inches"],
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
      required: false,
      default: [],
    },
    status: {
      type: String,
      enum: [
        "published",
        "requested",
        "in-transit",
        "to_handover",
        "delivered",
        "cancelled",
        "assigned",
        "expired",
      ],
      required: true,
    },
  },
  { timestamps: true }
);

const ConsignmentModel = model<Consignment>("Consignment", consignmentSchema);

export default ConsignmentModel;
