import logger from "../lib/logger";
import type { LocationUpdatePayload } from "./payload";

const activeLocations = new Map<string, LocationUpdatePayload>();

// Store/update location for a travel consignment
export const updateLocation = (
  travelConsignmentId: string,
  location: LocationUpdatePayload
) => {
  activeLocations.set(travelConsignmentId, location);
  logger.info(
    `[LocationStore] Updated location for ${travelConsignmentId}:` + location
  );
};

// Get stored location for a travel consignment
export const getLocation = (travelConsignmentId: string) => {
  return activeLocations.get(travelConsignmentId);
};

// Remove location from store (When delivery completes)
export const removeLocation = (travelConsignmentId: string) => {
  const deleted = activeLocations.delete(travelConsignmentId);
  if (deleted) {
    logger.info(`[LocationStore] Removed location for ${travelConsignmentId}`);
  }
};

// get all active tracking sessions (for debugging)
export const getAllActiveLocations = () => {
  return activeLocations;
};

// clear all locations (for cleanup/restart)
export const clearAllLocations = () => {
  activeLocations.clear();
  logger.info("[LocationStore] Cleared all locations");
};
