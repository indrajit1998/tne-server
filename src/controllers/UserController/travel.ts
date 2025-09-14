

import type { Request, Response } from "express";
import { TravelModel } from "../../models/travel.model";


export const createTravel = async (req: Request, res: Response) => {
  try {
    const travel = new TravelModel({
      ...req.body
    });

    const savedTravel = await travel.save();
    res.status(201).json({ message: "Travel created successfully", travel: savedTravel });
  } catch (error: any) {
    console.error("Error creating travel:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
