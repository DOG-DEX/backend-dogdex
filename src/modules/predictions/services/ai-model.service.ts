import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { AIModelDoc } from '../schemas/ai_models.model';
import { PredictionHistoryDoc } from '../schemas/prediction_history.model';
import { uploadFile } from '@huggingface/hub';
import { logger } from '../../../utils/logger.util';

@Injectable()
export class AIModelService {
  constructor(
    @InjectModel('AIModel') private aiModelModel: Model<AIModelDoc>,
    @InjectModel('PredictionHistory') private predictionHistoryModel: Model<PredictionHistoryDoc>
  ) {}

  async create(data: any, creator_id: string): Promise<AIModelDoc> {
    const newModel = new this.aiModelModel({ ...data, creator_id: new Types.ObjectId(creator_id) });
    return newModel.save();
  }

  async update(id: string, data: any): Promise<AIModelDoc | null> {
    return this.aiModelModel.findByIdAndUpdate(id, data, { new: true });
  }

  async findById(id: string): Promise<AIModelDoc | null> {
    return this.aiModelModel.findById(id);
  }

  async findAll(): Promise<any[]> {
    const models = await this.aiModelModel.find().sort({ createdAt: -1 }).lean();

    const stats = await this.predictionHistoryModel.aggregate([
      {
        $group: {
          _id: "$modelUsed",
          avgProcessingTime: { $avg: "$processingTime" }
        }
      }
    ]);

    const statsMap = new Map(stats.map(s => [s._id, s.avgProcessingTime]));

    return models.map(model => ({
      ...model,
      id: model._id.toString(),
      averageProcessingTime: Math.round(statsMap.get(model.name) || 0)
    }));
  }

  async findActiveModelForTask(taskType: string): Promise<AIModelDoc | null> {
    return this.aiModelModel.findOne({
      taskType: taskType as any,
      status: "ACTIVE",
    }).sort({ createdAt: -1 });
  }

  async activateModel(modelId: string): Promise<AIModelDoc | null> {
    const session: ClientSession = await this.aiModelModel.db.startSession();
    session.startTransaction();
    try {
      const modelToActivate = await this.aiModelModel.findById(modelId).session(session);
      if (!modelToActivate) {
        await session.endSession();
        return null;
      }

      await this.aiModelModel.updateMany(
        { taskType: modelToActivate.taskType, _id: { $ne: modelId } },
        { $set: { status: "INACTIVE" } },
        { session }
      );

      modelToActivate.status = "ACTIVE";
      const savedModel = await modelToActivate.save({ session });

      await session.commitTransaction();
      return savedModel;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async uploadAndCreateModel(modelFile: any, data: any, creator_id: string): Promise<AIModelDoc> {
    const hfToken = process.env.HUGGINGFACE_TOKEN;
    const repoId = process.env.HUGGINGFACE_REPO_ID;

    if (!hfToken || !repoId) {
      throw new BadRequestException("Hugging Face token or repository ID is not configured in .env file.");
    }

    try {
      logger.info(`Uploading model file '${modelFile.originalname}' to Hugging Face repo '${repoId}'...`);
      await uploadFile({
        credentials: { accessToken: hfToken },
        repo: { type: 'model', name: repoId },
        file: {
          path: data.path,
          content: new Blob([new Uint8Array(modelFile.buffer)]),
        },
      });
      logger.info("Model file uploaded successfully.");

      const newModel = new this.aiModelModel({ ...data, creator_id: new Types.ObjectId(creator_id), huggingFaceRepo: repoId, status: 'INACTIVE' });
      await newModel.save();
      logger.info(`New AI model record created in DB with ID: ${newModel._id}`);

      return newModel;
    } catch (error: any) {
      logger.error("Error during Hugging Face upload or DB creation:", error);
      throw new BadRequestException(`Failed to upload model: ${error.message}`);
    }
  }
}
