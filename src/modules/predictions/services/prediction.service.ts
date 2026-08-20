import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';

import {
  PredictionHistoryDoc,
  StreamResultPayload,
} from '../schemas/prediction_history.model';
import { MediaDoc } from '@/modules/media/schemas/medias.model';
import { DirectoryDoc } from '@/modules/media/schemas/directory.model';
import { AIModelService } from './ai-model.service';
import { AnalyticsService } from '@/modules/analytics/services/analytics.service';
import { MediaProcessorService } from '@/shared/media-processor/media-processor.service';
import { CloudinaryService } from '@/shared/cloudinary/cloudinary.service';
import { AIClientService } from '@/shared/ai-client/ai-client.service';
import { PredictionQueueService } from './prediction-queue.service';
import { logger } from '@/common/utils/logger.util';
import { PREDICTION_SOURCES } from '@/common/constants/prediction.constants';

import { GeminiService } from '@/shared/gemini/gemini.service';
import { redisClient } from '@/common/utils/redis.util';

@Injectable()
export class PredictionService {
  constructor(
    @InjectModel('PredictionHistory')
    private historyModel: Model<PredictionHistoryDoc>,
    @InjectModel('Media') private mediaModel: Model<MediaDoc>,
    @InjectModel('Directory') private directoryModel: Model<DirectoryDoc>,
    private readonly aiModel: AIModelService,
    private readonly analytics: AnalyticsService,
    private readonly mediaProcessor: MediaProcessorService,
    private readonly cloudinary: CloudinaryService,
    private readonly aiClient: AIClientService,
    private readonly queueService: PredictionQueueService,
    private readonly geminiService: GeminiService,
  ) { }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async getUserDirectoryId(
    userId: string,
  ): Promise<Types.ObjectId | undefined> {
    const dir = await this.directoryModel.findOne({
      creator_id: new Types.ObjectId(userId),
      parent_id: null,
    });
    return dir ? (dir._id as Types.ObjectId) : undefined;
  }

  private async getModelName(): Promise<string> {
    const model = await this.aiModel.findActiveModelForTask(
      'DOG_BREED_CLASSIFICATION',
    );
    return model?.name ?? 'unknown_model';
  }

  private trackEvent(
    userId: string | undefined,
    req: Request,
    processingTime?: number,
  ) {
    this.analytics.trackEvent({
      eventName: userId ? 'SUCCESSFUL_PREDICTION' : 'SUCCESSFUL_TRIAL',
      req,
      processingTime,
    });
  }

  // ─── Queue-based upload (image / video) ──────────────────────────────────────

  async makePrediction(
    userId: string | undefined,
    file: Express.Multer.File,
    type: 'image' | 'video',
    req: Request,
  ): Promise<{ predictionId: string; status: string }> {
    const predictionId = new Types.ObjectId();
    const directoryId = userId
      ? await this.getUserDirectoryId(userId)
      : undefined;
    const modelName = await this.getModelName();

    const newMedia = await this.mediaModel.create({
      name: file.originalname,
      mediaPath: 'processing',
      creator_id: userId ? new Types.ObjectId(userId) : undefined,
      directory_id: directoryId,
      type,
    });

    await this.historyModel.create({
      _id: predictionId,
      user: userId ? new Types.ObjectId(userId) : undefined,
      media: newMedia._id,
      mediaPath: 'processing',
      predictions: [],
      processedMediaPath: 'processing',
      modelUsed: modelName,
      source: `${type}_upload`,
      processingTime: 0,
    });

    await this.queueService.enqueuePrediction({
      predictionId: predictionId.toString(),
      mediaId: newMedia._id.toString(),
      userId,
      directoryId: directoryId?.toString(),
      filePath: file.path,
      fileOriginalName: file.originalname,
      fileType: type,
      modelName,
      startTime: Date.now(),
      analyticsData: { ip: req.ip, userAgent: req.headers['user-agent'] },
      lang:
        req.headers['accept-language']?.split(',')[0]?.toLowerCase() === 'vi'
          ? 'vi'
          : 'en',
    });

    return { predictionId: predictionId.toString(), status: 'processing' };
  }


  // ─── Ephemeral (no DB save) ───────────────────────────────────────────────────

  async makeEphemeralPrediction(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<any> {
    try {
      const buffer = await this.mediaProcessor.optimizeImage(file.path);
      const result = await this.aiClient.predict({
        id: new Types.ObjectId().toString(),
        userId: userId ? new Types.ObjectId(userId) : undefined,
        buffer,
        mediaType: 'image',
        resolve: () => { },
        reject: () => { },
      });
      if (!result?.predictions) throw new Error('Invalid result from AI');
      return {
        predictions: result.predictions,
        processed_media_base64: result.processed_media_base64,
      };
    } finally {
      // Always delete temp local disk file after processing
      if (file?.path) {
        const { existsSync, promises: fsPromises } = await import('fs');
        if (existsSync(file.path))
          await fsPromises.unlink(file.path).catch(() => { });
      }
    }
  }

  // ─── Batch predictions ────────────────────────────────────────────────────────

  async makeBatchPredictions(
    userId: string | undefined,
    files: Express.Multer.File[],
    req: Request,
  ): Promise<PredictionHistoryDoc[]> {
    const startTime = Date.now();
    const directoryId = userId
      ? await this.getUserDirectoryId(userId)
      : undefined;
    const modelName = await this.getModelName();

    const results = await Promise.all(
      files.map((file) =>
        this.processSingleBatchFile(file, userId, directoryId, modelName),
      ),
    );

    const predictions = results.filter(
      (p): p is PredictionHistoryDoc => p !== null,
    );
    this.trackEvent(userId, req);
    logger.info(
      `[PERF] BACKEND | batch | count: ${files.length} | total: ${Date.now() - startTime}ms`,
    );
    return predictions;
  }

  private async processSingleBatchFile(
    file: Express.Multer.File,
    userId: string | undefined,
    directoryId: Types.ObjectId | undefined,
    modelName: string,
  ): Promise<PredictionHistoryDoc | null> {
    try {
      const buffer = await this.mediaProcessor.optimizeImage(file.path);
      const filenameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');

      const [aiResult, originalPath] = await Promise.all([
        this.aiClient.predict({
          id: new Types.ObjectId().toString(),
          userId: userId ? new Types.ObjectId(userId) : undefined,
          buffer,
          mediaType: 'image',
          resolve: () => { },
          reject: () => { },
        }),
        this.cloudinary
          .uploadFile(
            file.path,
            `${filenameWithoutExt}_${Date.now()}`,
            'public/uploads/images',
            'image',
            'private',
          )
          .then((r) => `${r.public_id}.${r.format}`)
          .catch(() => file.filename),
      ]);

      if (!aiResult?.predictions || !aiResult?.processed_media_base64)
        throw new Error('Invalid AI result');

      const newMedia = await this.mediaModel.create({
        name: file.originalname,
        mediaPath: originalPath,
        creator_id: userId ? new Types.ObjectId(userId) : undefined,
        directory_id: directoryId,
        type: 'image',
      });

      const processedPath = await this.cloudinary.uploadBase64(
        aiResult.processed_media_base64,
        'public/processed/images',
        'image',
        'private',
      );

      const prediction = await this.historyModel.create({
        user: userId ? new Types.ObjectId(userId) : undefined,
        media: newMedia._id,
        mediaPath: newMedia.mediaPath,
        predictions: aiResult.predictions,
        processedMediaPath: processedPath,
        modelUsed: modelName,
        source: PREDICTION_SOURCES.IMAGE_UPLOAD,
      });

      return prediction.populate<{ media: MediaDoc }>([
        { path: 'user', select: '-password' },
        { path: 'media' },
      ]) as Promise<PredictionHistoryDoc>;
    } catch (err) {
      logger.error(`[BatchError] ${file.originalname}`, err);
      return null;
    } finally {
      if (file.path) {
        import('fs').then(({ existsSync, promises }) => {
          if (existsSync(file.path)) promises.unlink(file.path).catch(() => { });
        });
      }
    }
  }

  // ─── Stream capture ───────────────────────────────────────────────────────────

  async saveStreamPrediction(
    userId: string | undefined,
    payload: StreamResultPayload,
    req: Request,
  ): Promise<PredictionHistoryDoc> {
    const startTime = Date.now();
    const modelName = await this.getModelName();
    const directoryId = userId
      ? await this.getUserDirectoryId(userId)
      : undefined;

    const processedPath = await this.cloudinary.uploadBase64(
      payload.processed_media_base64,
      'public/processed/images',
      'image',
      'private',
    );
    const newMedia = await this.mediaModel.create({
      name: `Stream Capture - ${new Date().toISOString()}`,
      mediaPath: processedPath,
      creator_id: userId ? new Types.ObjectId(userId) : undefined,
      directory_id: directoryId,
      type: 'image',
    });

    const processingTime = Date.now() - startTime;
    this.trackEvent(userId, req, processingTime);

    const prediction = await this.historyModel.create({
      user: userId ? new Types.ObjectId(userId) : undefined,
      media: newMedia._id,
      mediaPath: processedPath,
      predictions: payload.detections,
      processedMediaPath: processedPath,
      modelUsed: modelName,
      source: PREDICTION_SOURCES.STREAM_CAPTURE,
      processingTime,
    });

    return prediction.populate<{ media: MediaDoc }>([
      { path: 'user', select: '-password' },
      { path: 'media' },
    ]) as Promise<PredictionHistoryDoc>;
  }

  // ─── URL prediction ───────────────────────────────────────────────────────────

  async makeUrlPrediction(
    userId: string | undefined,
    url: string,
    req: Request,
  ): Promise<PredictionHistoryDoc> {
    const startTime = Date.now();
    const finalUrl = await this.resolveUrl(url);
    const directoryId = userId
      ? await this.getUserDirectoryId(userId)
      : undefined;
    const modelName = await this.getModelName();

    const aiResult = await this.callAiWithUrl(finalUrl);
    if (!aiResult?.predictions)
      throw new Error('URL không hợp lệ hoặc không phải ảnh hợp lệ.');

    const processedPath = await this.cloudinary.uploadBase64(
      aiResult.processed_media_base64,
      'public/processed/images',
      'image',
      'private',
    );

    const newMedia = await this.mediaModel.create({
      name: `URL Prediction - ${new Date().toISOString()}`,
      mediaPath: finalUrl,
      creator_id: userId ? new Types.ObjectId(userId) : undefined,
      directory_id: directoryId,
      type: 'image',
    } as any);

    const processingTime = Date.now() - startTime;
    const prediction = await this.historyModel.create({
      user: userId ? new Types.ObjectId(userId) : undefined,
      media: (newMedia as any)._id,
      mediaPath: processedPath,
      predictions: aiResult.predictions,
      processedMediaPath: processedPath,
      modelUsed: modelName,
      source: PREDICTION_SOURCES.URL_INPUT,
      processingTime,
    });

    this.trackEvent(userId, req, processingTime);
    return prediction.populate<{ media: MediaDoc }>([
      { path: 'user', select: '-password' },
      { path: 'media' },
    ]) as Promise<PredictionHistoryDoc>;
  }

  private async resolveUrl(url: string): Promise<string> {
    try {
      if (url.startsWith('data:image')) {
        return this.cloudinary.uploadBase64(
          url.split(',')[1],
          'public/uploads/images',
          'image',
          'private',
        );
      }
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('google.com')) {
        return (
          urlObj.searchParams.get('imgurl') ||
          urlObj.searchParams.get('url') ||
          url
        );
      }
    } catch {
      /* ignore */
    }
    return url;
  }

  private async callAiWithUrl(url: string): Promise<any> {
    const axios = (await import('axios')).default;
    const aiUrl = process.env.AI_SERVICE_URL || '';
    const response = await axios.post(`${aiUrl}/predict/url`, { url });
    return response.data;
  }

  // ─── Status poll ──────────────────────────────────────────────────────────────

  getPredictionStatus(predictionId: string) {
    return this.aiClient.getProgress(predictionId);
  }

  // ─── Background job handlers (called by queue workers) ───────────────────────

  async processAsyncPrediction(data: any): Promise<void> {
    const {
      predictionId,
      fileType,
      filePath,
      fileOriginalName,
      mediaId,
      userId,
      directoryId,
      modelName,
      startTime,
      analyticsData,
    } = data;
    try {
      const buffer =
        fileType === 'image'
          ? await this.mediaProcessor.optimizeImage(filePath)
          : await this.mediaProcessor.optimizeVideo(filePath);

      const aiResult = await this.aiClient.predict({
        id: predictionId,
        userId: userId ? new Types.ObjectId(userId) : undefined,
        buffer,
        originalName: fileOriginalName,
        mediaType: fileType,
        resolve: () => { },
        reject: () => { },
      });

      await this.historyModel.findByIdAndUpdate(predictionId, {
        predictions: aiResult.predictions,
        processedMediaPath: 'processing',
      });

      const { promises: fs, existsSync } = await import('fs');
      const { default: os } = await import('os');
      const { default: path } = await import('path');
      const tempPath = path.join(os.tmpdir(), `processed_${predictionId}.txt`);
      await fs.writeFile(tempPath, aiResult.processed_media_base64);

      await this.queueService.enqueueUpload({
        predictionId,
        mediaId,
        predictionHistoryId: predictionId,
        userId,
        directoryId,
        filePath,
        fileOriginalName,
        fileType,
        predictionResult: { predictions: aiResult.predictions },
        processedMediaPathTemp: tempPath,
        modelName,
        startTime,
        analyticsData,
      });
    } catch (err) {
      logger.error(`[AsyncPrediction] Failed:`, err);
      await this.historyModel.findByIdAndUpdate(predictionId, {
        processedMediaPath: 'failed',
      });
      const { existsSync, promises } = await import('fs');
      if (existsSync(filePath)) await promises.unlink(filePath).catch(() => { });
    }
  }

  async processBackgroundUpload(data: any): Promise<void> {
    const {
      predictionId,
      mediaId,
      predictionHistoryId,
      userId,
      filePath,
      fileOriginalName,
      fileType,
      startTime,
      analyticsData,
      processedMediaPathTemp,
    } = data;
    const bgStart = Date.now();
    try {
      const { promises: fs } = await import('fs');
      const { default: path } = await import('path');

      const base64 = processedMediaPathTemp
        ? await fs.readFile(processedMediaPathTemp, 'utf-8').catch(() => null)
        : null;

      if (!base64) throw new Error('Missing processed media base64');

      const filenameWithoutExt = `${path.parse(fileOriginalName).name}_${startTime}`;
      const [originalPath, processedPath] = await Promise.all([
        this.cloudinary
          .uploadFile(
            filePath,
            filenameWithoutExt,
            `public/uploads/${fileType}s`,
            fileType,
            'private',
          )
          .then((r) => `${r.public_id}.${r.format}`),
        this.cloudinary.uploadBase64(
          base64,
          `public/processed/${fileType}s`,
          fileType,
          'private',
        ),
      ]);

      await this.mediaModel.findByIdAndUpdate(mediaId, {
        mediaPath: originalPath,
        type: fileType,
      });
      const processingTime = Date.now() - startTime;
      await this.historyModel.findByIdAndUpdate(predictionHistoryId, {
        mediaPath: originalPath,
        processedMediaPath: processedPath,
        processingTime,
      });

      const reqMock = {
        ip: analyticsData.ip,
        headers: { 'user-agent': analyticsData.userAgent },
        user: userId ? { _id: userId } : undefined,
      } as any;
      this.analytics.trackEvent({
        eventName: userId ? 'SUCCESSFUL_PREDICTION' : 'SUCCESSFUL_TRIAL',
        req: reqMock,
        processingTime,
      });

      logger.info(
        `[BackgroundUpload] Done ${predictionId} in ${Date.now() - bgStart}ms`,
      );
    } catch (err) {
      logger.error(`[BackgroundUpload] Failed ${predictionId}:`, err);
      await this.historyModel.findByIdAndUpdate(predictionHistoryId, {
        processedMediaPath: 'failed',
      });
    } finally {
      const { existsSync, promises } = await import('fs');
      if (existsSync(filePath)) await promises.unlink(filePath).catch(() => { });
      if (processedMediaPathTemp && existsSync(processedMediaPathTemp))
        await promises.unlink(processedMediaPathTemp).catch(() => { });
    }
  }

  // ─── Gemini AI Breed Chatbot ──────────────────────────────────────────────────

  async chatWithGemini(
    breedSlug: string,
    message: string,
    lang: 'vi' | 'en' = 'vi',
    userId?: string,
  ) {
    const breedName = breedSlug.replace(/-/g, ' ');
    const reply = await this.geminiService.chatWithBreed(breedName, message, lang);

    if (redisClient && userId) {
      const historyKey = `chat:history:${userId}:${breedSlug}`;
      try {
        const item = JSON.stringify({ role: 'user', content: message, reply, timestamp: new Date().toISOString() });
        await redisClient.lpush(historyKey, item);
        await redisClient.ltrim(historyKey, 0, 49); // Keep last 50 messages
      } catch (e) {
        logger.warn('[ChatHistory] Redis push failed:', e);
      }
    }

    return { reply };
  }

  async getChatHistory(breedSlug: string, userId?: string) {
    if (!redisClient || !userId) return { history: [] };
    const historyKey = `chat:history:${userId}:${breedSlug}`;
    try {
      const items = await redisClient.lrange(historyKey, 0, 49);
      if (!Array.isArray(items)) return { history: [] };
      const history = (items as string[])
        .map((item) => {
          try {
            return JSON.parse(item);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return { history };
    } catch {
      return { history: [] };
    }
  }
}
