//
// ──────────────────────────────────────────────────────────────
//   TRACKING METADATA CACHE
//   Stores senderId + travellerId per travelConsignmentId
// ──────────────────────────────────────────────────────────────
//

import type { LocationUpdatePayload } from './payload';

export interface TrackingMeta {
  travellerId: string;
  senderId: string;
}

export const trackingMetaStore = new Map<string, TrackingMeta>();

export const saveTrackingMeta = (travelConsignmentId: string, meta: TrackingMeta) => {
  trackingMetaStore.set(travelConsignmentId, meta);
};

export const getTrackingMeta = (travelConsignmentId: string) => {
  return trackingMetaStore.get(travelConsignmentId);
};

export const removeTrackingMeta = (travelConsignmentId: string) => {
  trackingMetaStore.delete(travelConsignmentId);
};

//
// ──────────────────────────────────────────────────────────────
//   THROTTLING CACHE
// ──────────────────────────────────────────────────────────────
//

export const trackingThrottleStore = new Map<string, number>();
export const trackingPendingUpdates = new Map<string, LocationUpdatePayload>();
export const trackingTimers = new Map<string, NodeJS.Timeout>();

export const BROADCAST_INTERVAL = 3000; // 3 seconds max
