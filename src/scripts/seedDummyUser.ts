import mongoose from 'mongoose';
import env from '../lib/env';
import { User } from '../models/user.model';
import logger from '../lib/logger';

async function seedDummyUser() {
  try {
    await mongoose.connect(env.DATABASE_URL);
    logger.info('✅ Connected to MongoDB');

    const DUMMY_PHONE = env.DUMMY_USER_PHONE;

    let dummyUser = await User.findOne({ phoneNumber: DUMMY_PHONE });

    if (!dummyUser) {
      dummyUser = await User.create({
        phoneNumber: DUMMY_PHONE,
        firstName: 'Review',
        lastName: 'User',
        email: 'reviewer@travelnearn.com',
        onboardingCompleted: true,
        isVerified: true,
        profilePictureUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        rating: 4.5,
        reviewCount: 10,
        completedTrips: 5,
      });
      logger.info('✅ Created dummy user:', dummyUser.id);
    } else {
      dummyUser.onboardingCompleted = true;
      dummyUser.isVerified = true;
      await dummyUser.save();
      logger.info('✅ Updated dummy user:', dummyUser.id);
    }

    logger.info('🎉 Dummy user seeding completed!');
    await mongoose.disconnect();
  } catch (error: any) {
    logger.error('❌ Error seeding dummy user:', error);
    process.exit(1);
  }
}

seedDummyUser();
