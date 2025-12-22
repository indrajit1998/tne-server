import cron from 'node-cron';
import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../lib/s3';
import logger from '../lib/logger';

const TEMP_PREFIX = 'temp/';
const MAX_AGE_HOURS = 6;

export const startTempCleanupJob = () => {
  cron.schedule('0 */3 * * *', async () => {
    // runs every 3 hours
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Prefix: TEMP_PREFIX,
      });

      const data = await s3.send(listCommand);
      if (!data.Contents?.length) return;

      const now = Date.now();

      for (const obj of data.Contents) {
        if (!obj.Key || !obj.LastModified) continue;

        const ageHours = (now - obj.LastModified.getTime()) / (1000 * 60 * 60);

        if (ageHours > MAX_AGE_HOURS) {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET_NAME!,
              Key: obj.Key,
            }),
          );

          logger.info(
            '[CLEANUP] Deleted temp file' +
              {
                key: obj.Key,
                ageHours: ageHours.toFixed(2),
              },
          );
        }
      }
    } catch (error) {
      logger.error('[CLEANUP] Temp cleanup failed' + error);
    }
  });
};
