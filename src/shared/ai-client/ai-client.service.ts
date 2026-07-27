import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../../common/utils/logger.util';
import { predictionNotifier } from '../../common/utils/predictionNotifier.util';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export interface BatchItem {
  id: string;
  userId?: any;
  file?: Express.Multer.File;
  buffer?: Buffer;
  originalName?: string;
  mediaType: 'image' | 'video';
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export interface PredictionProgress {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  message?: string;
  result?: any;
}

@Injectable()
export class AIClientService extends EventEmitter {
  private batches: Record<string, BatchItem[]> = {};
  private timers: Record<string, NodeJS.Timeout> = {};
  private progressMap = new Map<string, PredictionProgress>();
  private readonly maxBatchSize = 8;
  private readonly maxWaitTime = 50;

  private videoQueue: Queue;
  private videoWorker: Worker;
  private queueEvents: QueueEvents;

  private getRedisConfig() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const isTls = redisUrl.startsWith('rediss://');
    return {
      maxRetriesPerRequest: null,
      family: 4,
      keepAlive: 10000,
      ...(isTls && { tls: { rejectUnauthorized: false } }),
    };
  }

  constructor() {
    super();
    const connection = new IORedis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      this.getRedisConfig(),
    );
    const options = { connection };

    this.videoQueue = new Queue('video-batch-queue', options);
    this.queueEvents = new QueueEvents('video-batch-queue', options);
    this.videoWorker = new Worker('video-batch-queue', (job) => this.processVideoJob(job), {
      ...options,
      concurrency: 2,
    });

    this.videoWorker.on('progress', (job, progress) => {
      if (job) {
        this.updateProgress(job.id as string, 'processing', progress as number, 'Processing...');
        predictionNotifier.notify(job.id as string, 'progress', { progress });
      }
    });
    this.videoWorker.on('completed', (job, result) => {
      if (job) {
        this.updateProgress(job.id as string, 'completed', 100, 'Done', result);
        predictionNotifier.notify(job.id as string, 'completed', { result });
      }
    });
    this.videoWorker.on('failed', (job, err) => {
      if (job) {
        this.updateProgress(job.id as string, 'failed', 0, err.message);
        predictionNotifier.notify(job.id as string, 'failed', { message: err.message });
      }
    });
  }

  private updateProgress(id: string, status: PredictionProgress['status'], progress = 0, message = '', result?: any) {
    this.progressMap.set(id, { status, progress, message, result });
  }

  getProgress(predictionId: string): PredictionProgress {
    return this.progressMap.get(predictionId) || {
      status: 'not_found',
      message: 'Prediction not found',
    };
  }

  async predict(item: BatchItem): Promise<any> {
    if (item.mediaType === 'video') return this.handleVideoRequest(item);

    const batchKey = 'image';
    if (!this.batches[batchKey]) this.batches[batchKey] = [];
    this.batches[batchKey].push(item);
    this.updateProgress(item.id, 'queued', 0, 'Waiting...');

    if (this.batches[batchKey].length === 1 && !this.timers[batchKey]) {
      this.processBatch(batchKey);
    } else if (this.batches[batchKey].length >= this.maxBatchSize) {
      this.processBatch(batchKey);
    } else if (!this.timers[batchKey]) {
      this.timers[batchKey] = setTimeout(() => this.processBatch(batchKey), this.maxWaitTime);
    }

    return new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
  }

  private async handleVideoRequest(item: BatchItem): Promise<any> {
    let filePath = '';
    let cleanupNeeded = false;

    if (item.file) {
      filePath = item.file.path;
    } else if (item.buffer) {
      const fileName = item.originalName || `video-${item.id}.mp4`;
      filePath = path.join(os.tmpdir(), fileName);
      await fs.promises.writeFile(filePath, item.buffer);
      cleanupNeeded = true;
    } else {
      throw new Error('No file or buffer provided');
    }

    this.updateProgress(item.id, 'queued', 0, 'Waiting for video processing...');
    const job = await this.videoQueue.add(
      'process-video',
      { id: item.id, filePath, originalName: item.originalName, cleanupNeeded },
      { jobId: item.id, removeOnComplete: true, removeOnFail: 100 },
    );
    return job.waitUntilFinished(this.queueEvents);
  }

  private async processVideoJob(job: Job): Promise<any> {
    const { id, filePath, originalName, cleanupNeeded } = job.data;
    await job.updateProgress(10);
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), { filename: originalName || 'video.mp4' });
      await job.updateProgress(20);
      const response = await this.withRetry(() =>
        axios.post(`${AI_SERVICE_URL}/predict/video`, formData, {
          headers: { ...formData.getHeaders() },
          timeout: 600000,
        }),
      );
      await job.updateProgress(100);
      if (cleanupNeeded) fs.unlink(filePath, () => {});
      return response.data;
    } catch (error) {
      if (cleanupNeeded) fs.unlink(filePath, () => {});
      throw error;
    }
  }

  private async processBatch(batchKey: string) {
    if (this.timers[batchKey]) { clearTimeout(this.timers[batchKey]); delete this.timers[batchKey]; }
    if (!this.batches[batchKey]?.length) return;

    const batch = this.batches[batchKey];
    this.batches[batchKey] = [];

    try {
      const formData = new FormData();
      batch.forEach((item) => {
        if (item.buffer) formData.append('files', item.buffer, { filename: item.originalName || 'image.jpg' });
        else if (item.file) formData.append('files', fs.createReadStream(item.file.path), { filename: item.file.originalname });
      });
      batch.forEach((item) => this.updateProgress(item.id, 'processing', 0, 'Processing...'));

      await this.withRetry(async () => {
        const response = await axios.post(`${AI_SERVICE_URL}/predict/images`, formData, {
          headers: { ...formData.getHeaders() },
          timeout: 3000000,
        });
        const results = response.data.results;
        batch.forEach((item, i) => {
          this.updateProgress(item.id, 'completed', 100, 'Done', results[i]);
          item.resolve(results[i]);
        });
      });
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      batch.forEach((item) => {
        this.updateProgress(item.id, 'failed', 0, msg);
        item.reject(new Error(msg));
      });
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try { return await fn(); } catch (err) {
      if (retries > 0) {
        logger.warn(`[AIClient] Retrying... (${retries} left)`);
        await new Promise((r) => setTimeout(r, delay));
        return this.withRetry(fn, retries - 1, delay * 2);
      }
      throw err;
    }
  }
}
