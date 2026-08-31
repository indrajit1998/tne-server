import type { Response } from 'express';
import mongoose from 'mongoose';
import { getDateRange } from '../../lib/dateUtils';
import logger from '../../lib/logger';
import { formatDuration } from '../../lib/utils';
import type { AuthRequest } from '../../middlewares/authMiddleware';
import { Address } from '../../models/address.model';
import { TravelModel } from '../../models/travel.model';
import TravelConsignments from '../../models/travelconsignments.model';
import { geocodeAddress, getDistance } from '../../services/maps.service';

export const createTravel = async (req: AuthRequest, res: Response) => {
  try {
    const travelerId = req.user;
    const {
      fromAddressId,
      toAddressId,
      expectedStartDate,
      expectedEndDate,
      vehicleType,
      vehicleNumber,
      durationOfStay,
      modeOfTravel,
    } = req.body;

    // 1 Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(fromAddressId) ||
      !mongoose.Types.ObjectId.isValid(toAddressId)
    ) {
      return res.status(400).json({ message: 'Invalid address format' });
    }

    // 2 Fetch addresses
    const fromAddressObj = await Address.findById(fromAddressId);
    const toAddressObj = await Address.findById(toAddressId);

    if (!fromAddressObj || !toAddressObj) {
      return res.status(400).json({ message: 'Invalid address IDs' });
    }

    // 3 Validate dates
    const startTime = new Date(expectedStartDate).getTime();
    const endTime = new Date(expectedEndDate).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (endTime < startTime) {
      return res.status(400).json({ message: 'Expected end date cannot be before start date' });
    }

    // 4 Prepare addresses
    const fromAddress = {
      street: fromAddressObj.street,
      city: fromAddressObj.city,
      postalCode: fromAddressObj.postalCode,
      country: fromAddressObj.country,
      state: fromAddressObj.state,
      landmark: fromAddressObj.landMark,
      flatNo: fromAddressObj.flatNo,
    };

    const toAddress = {
      street: toAddressObj.street,
      city: toAddressObj.city,
      postalCode: toAddressObj.postalCode,
      country: toAddressObj.country,
      state: toAddressObj.state,
      landmark: toAddressObj.landMark,
      flatNo: toAddressObj.flatNo,
    };

    // 5 Calculate distance
    const distance = await getDistance(fromAddressObj.city, toAddressObj.city);

    // 6 Calculate duration safely
    const durationOfTravel = formatDuration(expectedStartDate, expectedEndDate);

    // 7 Create travel
    const travel = await TravelModel.create({
      travelerId,
      fromAddress,
      toAddress,
      fromCoordinates: fromAddressObj.location,
      toCoordinates: toAddressObj.location,
      expectedStartDate,
      expectedEndDate,
      distance: distance ? distance.distance : 'N/A',
      vehicleType,
      vehicleNumber,
      durationOfStay,
      durationOfTravel,
      status: 'upcoming',
      modeOfTravel,
    });

    return res.status(201).json({ message: 'Travel created successfully', travel });
  } catch (error: any) {
    console.error('Error creating travel:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTravels = async (req: AuthRequest, res: Response) => {
  try {
    const travelerId = req.user;
    const travels = await TravelModel.find({ travelerId: travelerId }).sort({
      createdAt: -1,
    });
    if (!travels || travels.length === 0) {
      return res.status(404).json({ message: 'No travels found' });
    }
    return res.status(200).json({ message: 'Travels fetched successfully', travels });
  } catch (error) {
    console.error('Error fetching travels:', error);
    res.status(500).json({ message: 'Internal server error while fetching travels' });
  }
};

export const locateTravel = async (req: AuthRequest, res: Response) => {
  try {
    const {
      fromstate,
      tostate,
      date,
      modeOfTravel,
      fromLat,
      fromLng,
      toLat,
      toLng,
      radius,
    } = req.query as {
      fromstate: string;
      tostate: string;
      date: string;
      modeOfTravel?: 'air' | 'roadways' | 'train';
      fromLat?: string;
      fromLng?: string;
      toLat?: string;
      toLng?: string;
      radius?: string;
    };
    const currentUserId = req.user;

    if (!fromstate || !tostate || !date) {
      return res.status(400).json({
        message: 'Missing required query parameters: fromstate, tostate, date',
      });
    }

    // Normalize and tokenize for flexible partial matching
    const tokenize = (str: string) =>
      str
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);

    const fromTokens = tokenize(fromstate);
    const toTokens = tokenize(tostate);

    const fromRegexes = fromTokens.map(t => new RegExp(t, 'i'));
    const toRegexes = toTokens.map(t => new RegExp(t, 'i'));

    // Parse date using utility
    let startOfDay: Date, endOfDay: Date;
    try {
      ({ startOfDay, endOfDay } = getDateRange(date));
    } catch (error) {
      logger.error(`Date parsing error: ${error}`);
      return res.status(400).json({
        message: `Invalid date format: ${date}. Expected DD/MM/YYYY (e.g., 25/11/2025)`,
        error: error instanceof Error ? error.message : 'Date parsing failed',
      });
    }

    // Radius calculation (Default: 100 km)
    const searchRadiusKm = Number(radius) || 100;
    const EARTH_RADIUS_KM = 6378.1;
    const radiusInRadians = searchRadiusKm / EARTH_RADIUS_KM;

    let originCoords: { lat: number; lng: number } | null = null;
    let destCoords: { lat: number; lng: number } | null = null;

    if (fromLat && fromLng) {
      originCoords = { lat: Number(fromLat), lng: Number(fromLng) };
    } else {
      originCoords = await geocodeAddress(fromstate);
    }

    if (toLat && toLng) {
      destCoords = { lat: Number(toLat), lng: Number(toLng) };
    } else {
      destCoords = await geocodeAddress(tostate);
    }

    let travelMode: string | undefined;

    if (modeOfTravel) {
      const normalized = modeOfTravel.toLowerCase();
      if (['air', 'airways', 'airplane', 'flight'].includes(normalized)) {
        travelMode = 'air';
      } else if (['road', 'roadways', 'car', 'bus', 'vehicle'].includes(normalized)) {
        travelMode = 'roadways';
      } else if (['train', 'rail', 'railways'].includes(normalized)) {
        travelMode = 'train';
      } else {
        travelMode = normalized; // fallback to raw string if it’s something new
      }
    } else {
      travelMode = undefined;
    }

    logger.info(
      `🔍 Locating travels from "${fromstate}" → "${tostate}" within ${searchRadiusKm}km radius on ${startOfDay.toISOString()} ${
        travelMode ? `(mode: ${travelMode})` : ''
      }`
    );

    const fromConditions: any[] = [];
    if (originCoords) {
      fromConditions.push({
        fromCoordinates: {
          $geoWithin: {
            $centerSphere: [
              [originCoords.lng, originCoords.lat],
              radiusInRadians,
            ],
          },
        },
      });
    }
    fromConditions.push(
      { 'fromAddress.state': { $in: fromRegexes } },
      { 'fromAddress.city': { $in: fromRegexes } },
      { 'fromAddress.street': { $in: fromRegexes } },
      { 'fromAddress.state': { $regex: fromstate, $options: 'i' } },
      { 'fromAddress.city': { $regex: fromstate, $options: 'i' } }
    );

    const toConditions: any[] = [];
    if (destCoords) {
      toConditions.push({
        toCoordinates: {
          $geoWithin: {
            $centerSphere: [
              [destCoords.lng, destCoords.lat],
              radiusInRadians,
            ],
          },
        },
      });
    }
    toConditions.push(
      { 'toAddress.state': { $in: toRegexes } },
      { 'toAddress.city': { $in: toRegexes } },
      { 'toAddress.street': { $in: toRegexes } },
      { 'toAddress.state': { $regex: tostate, $options: 'i' } },
      { 'toAddress.city': { $regex: tostate, $options: 'i' } }
    );

    const query: any = {
      $and: [
        { $or: fromConditions },
        { $or: toConditions },
        {
          expectedStartDate: { $gte: startOfDay, $lt: endOfDay },
          status: 'upcoming',
          travelerId: { $ne: currentUserId },
        },
      ],
    };

    // logger.info("before travelmode if..");

    if (travelMode) query.$and.push({ modeOfTravel: travelMode });

    // logger.info("after travelmode if..");

    const travels = await TravelModel.find(query)
      .populate({
        path: 'travelerId',
        select: 'firstName lastName phoneNumber profilePictureUrl rating reviewCount',
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // logger.info("after travels query..");

    if (!travels.length) {
      logger.info(
        `❌ No travels found for ${fromstate} → ${tostate} on ${date} ${
          travelMode ? `(${travelMode})` : ''
        }`,
      );
      return res.status(404).json({ message: 'No travels found', travels: [] });
    }

    return res.status(200).json({ message: 'Travels fetched successfully', travels });
  } catch (error: any) {
    logger.error('❌ Error locating travel:', error);
    return res.status(500).json({
      message: 'Internal server error while locating travel',
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const locateTravelbyid = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const travel = await TravelModel.findById(id);
    if (!travel) {
      return res.status(404).json({ message: 'No travel found' });
    }
    return res.status(200).json({ message: 'Travel fetched successfully', travel });
  } catch (error) {
    console.error('Error fetching travel by ID:', error);
    res.status(500).json({ message: 'Internal server error while fetching travel by ID' });
  }
};

export const startTravel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    }

    const { travelId } = req.params;

    const travel = await TravelModel.findById(travelId);
    if (!travel) return res.status(404).json({ message: 'Travel not found' });

    if (travel.travelerId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // ✅ Only allow starting if current status is 'upcoming'
    if (travel.status !== 'upcoming') {
      return res.status(400).json({ message: 'Travel is not upcoming' });
    }

    // ✅ Update to 'ongoing'
    travel.status = 'ongoing';
    travel.startedAt = new Date();
    await travel.save();

    return res.status(200).json({ message: 'Travel started', travel });
  } catch (err) {
    console.error('Error starting travel:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const endTravel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    }

    const { travelId } = req.params;

    const travel = await TravelModel.findById(travelId);
    if (!travel) return res.status(404).json({ message: 'Travel not found' });
    if (travel.travelerId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (travel.status !== 'ongoing') {
      console.log('yaha se h');
      return res.status(400).json({ message: 'Travel is not ongoing' });
    }

    const pendingConsignments = await TravelConsignments.find({
      travelId,
      status: { $ne: 'delivered' },
    });

    if (pendingConsignments.length > 0) {
      return res.status(400).json({
        message:
          'You cannot end the travel before all the consignments are collected by the receivers. If not collected by receivers please contact support centre.\n\n📞 Phone: 9627542222\n📧 Email: support@travelnearn.com',
      });
    }

    travel.status = 'completed';
    travel.completedAt = new Date();
    await travel.save();

    return res.status(200).json({ message: 'Travel ended', travel });
  } catch (err) {
    console.error('Error ending travel:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const cancelTravel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    }

    const { travelId } = req.params;

    const travel = await TravelModel.findById(travelId);
    if (!travel) return res.status(404).json({ message: 'Travel not found' });
    if (travel.travelerId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    if (travel.status !== 'upcoming') {
      return res.status(400).json({ message: 'Only upcoming travels can be cancelled' });
    }

    travel.status = 'cancelled';
    await travel.save();

    return res.status(200).json({ message: 'Travel cancelled', travel });
  } catch (err) {
    console.error('Error cancelling travel:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
