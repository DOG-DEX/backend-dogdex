import { Queue, Worker, Job } from 'bullmq';
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

export interface UploadJobData {
  predictionId: string;
  mediaId: string;
  predictionHistoryId: string;
  userId: string | undefined;
  directoryId: string | undefined;
  filePath: string;
  fileOriginalName: string;
  fileType: 'image' | 'video';
  predictionResult: {
    predictions: any[];
  };
  processedMediaPathTemp?: string;
  modelName: string;
  startTime: number;
  analyticsData: any;
}

let uploadProcessor: ((data: UploadJobData) => Promise<void>) | null = null;

export const setUploadProcessor = (
  processor: (data: UploadJobData) => Promise<void>,
) => {
  uploadProcessor = processor;
};

const isRedisDisabled = process.env.USE_REDIS === 'false';

export const uploadQueue: Queue<UploadJobData> = isRedisDisabled
  ? ({
      add: async (name: string, data: UploadJobData) => {
        logger.info(
          `[UploadQueue] Redis disabled (USE_REDIS=false). Running job directly: ${name}`,
        );
        if (uploadProcessor) {
          setImmediate(() => {
            uploadProcessor!(data).catch((err) =>
              logger.error(`[UploadQueue] Direct job execution failed:`, err),
            );
          });
        }
        return { id: `mock-upload-job-${Date.now()}` } as any;
      },
    } as any)
  : new Queue<UploadJobData>('upload-queue', {
      connection: new IORedis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        getRedisConfig(),
      ),
    });

if (!isRedisDisabled) {
  const worker = new Worker<UploadJobData>(
    'upload-queue',
    async (job: Job<UploadJobData>) => {
      logger.info(
        `[UploadWorker] Processing job ${job.id} for prediction ${job.data.predictionId}`,
      );
      if (uploadProcessor) {
        await uploadProcessor(job.data);
      } else {
        logger.warn(
          `[UploadWorker] No uploadProcessor registered for job ${job.id}`,
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

  worker.on('error', (err) => {
    logger.error(`[UploadWorker] Worker error: ${err.message}`);
  });

  worker.on('ready', () => {
    logger.info(
      `[UploadWorker] Worker is ready and listening on queue 'upload-queue'`,
    );
  });

  worker.on('completed', (job) => {
    logger.info(`[UploadWorker] Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    logger.error(
      `[UploadWorker] Job ${job?.id} has failed with ${err.message}`,
    );
  });
}

