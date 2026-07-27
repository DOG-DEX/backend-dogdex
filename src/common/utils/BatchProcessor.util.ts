import { EventEmitter } from 'events';
import { Types } from 'mongoose';
import { logger } from './logger.util';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { predictionNotifier } from './predictionNotifier.util';

const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const isTls = redisUrl.startsWith('rediss://');
  return {
    maxRetriesPerRequest: null,
    family: 4,
    keepAlive: 10000,
    ...(isTls && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  };
};
const redisConfig = getRedisConfig();

export interface BatchItem {
  id: string;
  userId: Types.ObjectId | undefined;
  file?: Express.Multer.File;
  buffer?: Buffer;
  originalName?: string;
  mediaType: 'image' | 'video';
  onProgress?: (progress: number) => void;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export interface PredictionProgress {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  message?: string;
  result?: any;
}

export class BatchProcessor extends EventEmitter {
  private progressMap: Map<string, PredictionProgress> = new Map();
  private videoQueue: Queue;
  private videoWorker: Worker;
  private queueEvents: QueueEvents;

  constructor() {
    super();
    const options = {
      connection: new IORedis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        redisConfig,
      ),
    };
    this.videoQueue = new Queue('video-batch-queue', options);
    this.queueEvents = new QueueEvents('video-batch-queue', options);

    this.videoWorker = new Worker(
      'video-batch-queue',
      async (job: Job) => {
        return null;
      },
      {
        ...options,
        concurrency: 2,
      },
    );

    this.videoWorker.on('progress', (job, progress) => {
      if (job) {
        this.updateProgress(
          job.id as string,
          'processing',
          progress as number,
          'Đang xử lý video...',
        );
        predictionNotifier.notify(job.id as string, 'progress', { progress });
      }
    });

    this.videoWorker.on('completed', (job, result) => {
      if (job) {
        this.updateProgress(
          job.id as string,
          'completed',
          100,
          'Xử lý video hoàn tất',
          result,
        );
        predictionNotifier.notify(job.id as string, 'completed', { result });
      }
    });

    this.videoWorker.on('failed', (job, err) => {
      if (job) {
        this.updateProgress(job.id as string, 'failed', 0, err.message);
        predictionNotifier.notify(job.id as string, 'failed', {
          error: err.message,
        });
      }
    });
  }

  public updateProgress(
    id: string,
    status: PredictionProgress['status'],
    progress?: number,
    message?: string,
    result?: any,
  ) {
    this.progressMap.set(id, { status, progress, message, result });
  }

  public getProgress(id: string): PredictionProgress {
    return (
      this.progressMap.get(id) || {
        status: 'not_found',
        progress: 0,
        message: 'Không tìm thấy tiến trình',
      }
    );
  }
}
