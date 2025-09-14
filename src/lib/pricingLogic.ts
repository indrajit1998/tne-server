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
    fare += Math.ceil(weight - 1) * config.weightRateTrain;
  }

  let distanceFare = 0;

  if (distance > 200) {
    let remaining = distance - 200;

    if (remaining <= 300) {
      distanceFare = config.distanceRateTrain * weight;
    } else {
      remaining -= 300;
      let extraSlabs = Math.ceil(remaining / 500);
      distanceFare = (1 + extraSlabs) * config.distanceRateTrain;
    }
  }

  fare += distanceFare;
  const totalCost = fare + config.TE;

  // Apply margin for sender's final payment
  const senderPayment = Math.round(totalCost * (1 + config.margin));

  return {
    travelerEarn: fare,
    senderPay: senderPayment,
  };
}

export async function calculateFlightFare(weight: number, distance: number) {
  const config = await FareConfigModel.findOne();
  if (!config) {
    throw new Error("Fare configuration not found");
  }
  if (weight <= 0 || distance <= 0) {
    throw new Error("Invalid weight or distance");
  }

  let fare = config.baseFareFlight;

  if (weight > 1) {
    fare += Math.ceil(weight - 1) * config.weightRateFlight;
  }

  if (distance > 500) {
    const extraDistance = distance - 500;
    const slabs = Math.ceil(extraDistance / 500); // each 500km slab
    fare += slabs * config.distanceRateFlight; // apply slab per kg
  }

  const totalCost = fare + config.TE;

  const senderPayment = Math.round(totalCost * (1 + config.margin));

  return {
    travelerEarn: fare,
    senderPay: senderPayment,
  };
}
