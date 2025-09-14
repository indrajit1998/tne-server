import { model, Schema } from "mongoose";

interface FareConfig {
  TE: number;
  deliveryFee: number;
  margin: number;
  weightRateTrain: number;
  distanceRateTrain: number;
  baseFareTrain: number;
  weightRateFlight: number;
  distanceRateFlight: number;
  baseFareFlight: number;
}

const fareConfigSchema = new Schema<FareConfig>(
  {
    TE: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    margin: { type: Number, required: true },
    weightRateTrain: { type: Number, required: true },
    distanceRateTrain: { type: Number, required: true },
    baseFareTrain: { type: Number, required: true },
    weightRateFlight: { type: Number, required: true },
    distanceRateFlight: { type: Number, required: true },
    baseFareFlight: { type: Number, required: true },
  },
  { timestamps: true }
);

const FareConfigModel = model<FareConfig>("FareConfig", fareConfigSchema);

export default FareConfigModel;
