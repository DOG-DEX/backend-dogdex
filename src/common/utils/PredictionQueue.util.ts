import { Queue, Worker } from 'bullmq';
import { logger } from './logger.util';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const isTls = redisUrl.startsWith('rediss://');
  return {
    maxRetriesPerRequest: null,
    family: 4, // Force IPv4
    keepAlive: 10000,
    retryStrategy: (times: number) => Math.min(times * 500, 5000),
    ...(isTls && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  };
};

export interface PredictionJobData {
  predictionId: string;
  mediaId: string;
  userId: string | undefined;
  directoryId: string | undefined;
  filePath: string;
  fileOriginalName: string;
  fileType: 'image' | 'video';
  modelName: string;
  startTime: number;
  analyticsData: any;
  lang?: 'vi' | 'en';
}

const isRedisDisabled = process.env.USE_REDIS === 'false';

export const predictionQueue: Queue<PredictionJobData> = isRedisDisabled
  ? ({
      add: async (name: string, data: any) => {
        logger.info(
          `[PredictionQueue] Redis disabled (USE_REDIS=false). Bypassing job: ${name}`,
        );
        return { id: `mock-prediction-job-${Date.now()}` } as any;
      },
    } as any)
  : new Queue<PredictionJobData>('prediction-queue', {
      connection: new IORedis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        getRedisConfig(),
      ),
    });

if (!isRedisDisabled) {
  const worker = new Worker<PredictionJobData>(
    'prediction-queue',
    async (job) => {
      logger.info(`[PredictionWorker] Processing job ${job.id}`);
    },
    {
      connection: new IORedis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        getRedisConfig(),
      ),
      concurrency: 2,
    },
  );
}
