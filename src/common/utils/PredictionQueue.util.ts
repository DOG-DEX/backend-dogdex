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

let predictionProcessor: ((data: PredictionJobData) => Promise<void>) | null = null;

export const setPredictionProcessor = (
  processor: (data: PredictionJobData) => Promise<void>,
) => {
  predictionProcessor = processor;
};

const isRedisDisabled = process.env.USE_REDIS === 'false';

export const predictionQueue: Queue<PredictionJobData> = isRedisDisabled
  ? ({
      add: async (name: string, data: PredictionJobData) => {
        logger.info(
          `[PredictionQueue] Redis disabled (USE_REDIS=false). Running job directly: ${name}`,
        );
        if (predictionProcessor) {
          setImmediate(() => {
            predictionProcessor!(data).catch((err) =>
              logger.error(`[PredictionQueue] Direct job execution failed:`, err),
            );
          });
        }
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
      if (predictionProcessor) {
        await predictionProcessor(job.data);
      } else {
        logger.warn(
          `[PredictionWorker] No predictionProcessor registered for job ${job.id}`,
        );
      }
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

