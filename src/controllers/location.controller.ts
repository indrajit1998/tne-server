import type { Request, Response } from "express";
import { CODES } from "../constants/statusCodes";
import sendResponse from "../lib/ApiResponse";
import { getPlaceDetails, getPlacePredictions } from "../services/maps.service";
const getSuggestions = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim() === "") {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "Query parameter 'q' is required"
          )
        );
    }
    const suggestions = await getPlacePredictions(query);
    return res
      .status(CODES.OK)
      .json(
        sendResponse(CODES.OK, suggestions, "Suggestions fetched successfully")
      );
  } catch (error) {
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "An error occurred")
      );
  }
};

const getLocationDetails = async (req: Request, res: Response) => {
  try {
    const placeId = req.query.placeId as string;
    if (!placeId || placeId.trim() === "") {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "Query parameter 'placeId' is required"
          )
        );
    }

    const details = await getPlaceDetails(placeId);
    if (!details) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "Place not found"));
    }

    return res
      .status(CODES.OK)
      .json(
        sendResponse(CODES.OK, details, "Place details fetched successfully")
      );
  } catch (error) {
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "An error occurred")
      );
  }
};

export { getSuggestions, getLocationDetails };
