import type { Server, Socket } from 'socket.io';
import logger from '../lib/logger';
import TravelConsignments from '../models/travelconsignments.model';
import {
  saveTrackingMeta,
  getTrackingMeta,
  removeTrackingMeta,
  trackingThrottleStore,
  trackingPendingUpdates,
  trackingTimers,
  BROADCAST_INTERVAL,
} from './trackingStore';

import { updateLocation, getLocation, removeLocation } from './locationStore';

import type { LocationEmitPayload, LocationJoinPayload, LocationUpdatePayload } from './payload';

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types';

const trackingRoomPrefix = 'tracking:';

export const setupLocationHandlers = (
  socket: Socket & { data: SocketData },
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
) => {
  const userId = socket.data.userId;

  logger.info(`[LocationHandlers] Setting up handlers for user ${userId}`);

  // ──────────────────────────────────────────────────────────────
  // 📌 LOCATION EMIT FROM TRAVELLER
  // ──────────────────────────────────────────────────────────────
  socket.on('location:emit', async (data: LocationEmitPayload, ack?: (res: any) => void) => {
    try {
      const consignmentId = data.travelConsignmentId.toString();
      let meta = getTrackingMeta(consignmentId);

      //
      // ───────────────────────────────
      // 1. First emission → cache metadata
      // ───────────────────────────────
      //
      if (!meta) {
        const travelConsignment = await TravelConsignments.findById(consignmentId)
          .populate('travelId')
          .populate('consignmentId');

        if (!travelConsignment) {
          ack?.({ ok: false, error: 'NOT_FOUND' });
          return;
        }

        // @ts-ignore
        const travellerId = travelConsignment.travelId?.travelerId?.toString();
        // @ts-ignore
        const senderId = travelConsignment.consignmentId?.senderId?.toString();

        meta = {
          travellerId,
          senderId,
        };

        saveTrackingMeta(consignmentId, meta);
      }

      //
      // ───────────────────────────────
      // 2. Fast authorization
      // ───────────────────────────────
      //
      if (meta.travellerId !== userId) {
        ack?.({ ok: false, error: 'UNAUTHORIZED' });
        return;
      }

      //
      // ───────────────────────────────
      // 3. Status check (only once at beginning)
      // ───────────────────────────────
      //
      const consignmentDoc = await TravelConsignments.findById(consignmentId);
      if (consignmentDoc?.status !== 'in_transit') {
        ack?.({ ok: false, error: 'NOT_IN_TRANSIT' });
        return;
      }

      //
      // ───────────────────────────────
      // 4. Prepare payload
      // ───────────────────────────────
      //
      const payload: LocationUpdatePayload = {
        travelConsignmentId: consignmentId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp || new Date().toISOString(),
        heading: data.heading,
        speed: data.speed,
      };

      updateLocation(consignmentId, payload);

      //
      // ───────────────────────────────
      // 5. THROTTLE BROADCASTING
      // ───────────────────────────────
      //
      const lastEmit = trackingThrottleStore.get(consignmentId);
      const now = Date.now();

      if (!lastEmit || now - lastEmit >= BROADCAST_INTERVAL) {
        trackingThrottleStore.set(consignmentId, now);

        const room = `${trackingRoomPrefix}${consignmentId}`;
        io.to(room).emit('location:update', payload);

        ack?.({ ok: true });
        return;
      }

      // too early → store pending
      trackingPendingUpdates.set(consignmentId, payload);

      // set timer if not already active
      if (!trackingTimers.has(consignmentId)) {
        const timer = setTimeout(() => {
          const latest = trackingPendingUpdates.get(consignmentId);
          trackingTimers.delete(consignmentId);
          trackingPendingUpdates.delete(consignmentId);

          if (latest) {
            const room = `${trackingRoomPrefix}${consignmentId}`;
            io.to(room).emit('location:update', latest);
            trackingThrottleStore.set(consignmentId, Date.now());
          }
        }, BROADCAST_INTERVAL);

        trackingTimers.set(consignmentId, timer);
      }

      ack?.({ ok: true });
    } catch (err: any) {
      logger.error('location:emit error:', err);
      ack?.({ ok: false, error: 'SERVER_ERROR' });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // 📌 SENDER JOINS TRACKING ROOM
  // ──────────────────────────────────────────────────────────────
  socket.on('location:join', async (data: LocationJoinPayload, ack?: (res: any) => void) => {
    try {
      const consignmentId = data.travelConsignmentId.toString();
      const meta = getTrackingMeta(consignmentId);

      if (!meta) {
        ack?.({ ok: false, error: 'META_NOT_READY' });
        return;
      }

      // sender auth
      if (meta.senderId !== userId) {
        ack?.({ ok: false, error: 'UNAUTHORIZED' });
        return;
      }

      const room = `${trackingRoomPrefix}${consignmentId}`;
      socket.join(room);

      const lastLocation = getLocation(consignmentId);
      if (lastLocation) {
        socket.emit('location:update', lastLocation);
      }

      ack?.({ ok: true });
    } catch (err: any) {
      logger.error('location:join error:', err);
      ack?.({ ok: false, error: 'SERVER_ERROR' });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // 📌 LEAVING ROOM
  // ──────────────────────────────────────────────────────────────
  socket.on('location:leave', (consignmentId: string) => {
    socket.leave(`${trackingRoomPrefix}${consignmentId}`);
  });

  // ──────────────────────────────────────────────────────────────
  // 📌 CLEANUP ON DISCONNECT
  // ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    logger.info(`[LocationHandlers] User ${userId} disconnected`);
  });
};
