import mongoose, { Schema, Types } from "mongoose";

interface Address {
  userId: Types.ObjectId;
  label: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
}

const addressSchema = new Schema<Address>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    location: {
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
  },
  { timestamps: true }
);

addressSchema.index({ location: "2dsphere" });

export const Address = mongoose.model<Address>("Address", addressSchema);
