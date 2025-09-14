import FareConfigModel from "../models/fareconfig.model";

export async function calculateTrainFare(weight: number, distance: number) {
  const config = await FareConfigModel.findOne();
  if (!config) {
    throw new Error("Fare configuration not found");
  }
  if (weight <= 0 || distance <= 0) {
    throw new Error("Invalid weight or distance");
  }

  let fare = config.baseFareTrain;

  if (weight > 1) {
    fare += (weight - 1) * config.weightRateTrain;
  }

  if (distance > 200) {
    const extraDistance = distance - 200;
    const slabs = Math.ceil(extraDistance / 500); // each 500km slab
    fare += slabs * config.distanceRateTrain * weight; // apply slab per kg
  }

  const totalCost = fare + config.TE;

  // Apply margin for sender's final payment
  const senderPayment = Math.round(totalCost * (1 + config.margin));
  const marginValue = senderPayment - totalCost;

  return {
    baseFare: fare,
    totalCost,
    senderPayment,
    margin: marginValue,
  };
}
