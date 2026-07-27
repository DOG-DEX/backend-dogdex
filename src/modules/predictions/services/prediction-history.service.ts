import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PredictionHistoryDoc } from '../schemas/prediction_history.model';
import { UserDoc } from '../../users/schemas/user.model';
import { FeedbackDoc } from '../../community/schemas/feedback.model';

export interface GetHistoryQuery {
  page?: number;
  limit?: number;
  userId?: string;
  search?: string;
}

@Injectable()
export class PredictionHistoryService {
  constructor(
    @InjectModel('PredictionHistory')
    private predictionHistoryModel: Model<PredictionHistoryDoc>,
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('Feedback') private feedbackModel: Model<FeedbackDoc>,
  ) {}

  async getHistoryForUser(userId: string, query: GetHistoryQuery) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter: any = { user: new Types.ObjectId(userId), isDeleted: false };

    const histories = await this.predictionHistoryModel
      .find(filter)
      .populate('media')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await this.predictionHistoryModel.countDocuments(filter);

    return {
      histories,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async getHistoryByIdForUser(userId: string, historyId: string) {
    const history = await this.predictionHistoryModel
      .findOne({
        _id: historyId,
        user: new Types.ObjectId(userId),
        isDeleted: false,
      })
      .populate('media');

    if (!history) {
      throw new ConflictException('Không tìm thấy lịch sử dự đoán.');
    }
    return history;
  }

  async deleteHistoryForUser(userId: string, historyId: string) {
    const result = await this.predictionHistoryModel.updateOne(
      { _id: historyId, user: new Types.ObjectId(userId), isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );

    if (result.modifiedCount === 0) {
      throw new ConflictException('Không tìm thấy lịch sử dự đoán để xóa.');
    }
  }

  async getAllHistory(query: GetHistoryQuery) {
    const { page = 1, limit = 10, userId, search } = query;
    const skip = (page - 1) * limit;

    const filter: any = { isDeleted: false };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const users = await this.userModel
        .find({
          $or: [{ username: searchRegex }, { email: searchRegex }],
        })
        .select('_id');

      const userObjectIds = users.map((u) => u._id);

      filter.$or = [
        { user: { $in: userObjectIds } },
        { 'predictions.class': searchRegex },
      ];
    } else if (userId) {
      filter.user = new Types.ObjectId(userId) as any;
    }

    const histories = await this.predictionHistoryModel
      .find(filter)
      .populate('media')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await this.predictionHistoryModel.countDocuments(filter);

    return {
      histories,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async getHistoryById(historyId: string) {
    const history = await this.predictionHistoryModel
      .findOne({ _id: historyId, isDeleted: false })
      .populate('media')
      .populate('user', 'username email');

    if (!history) {
      throw new ConflictException('Không tìm thấy lịch sử dự đoán.');
    }
    return history;
  }

  async deleteHistory(historyId: string, hardDelete = false) {
    const history = await this.predictionHistoryModel.findById(historyId);
    if (!history) {
      throw new ConflictException('Không tìm thấy lịch sử dự đoán để xóa.');
    }

    if (hardDelete) {
      await this.feedbackModel.deleteMany({ prediction_id: history._id });
      await this.predictionHistoryModel.deleteOne({ _id: historyId });
    } else {
      if (history.isDeleted) return;
      history.isDeleted = true;
      history.updatedAt = new Date();
      await history.save();
      await this.feedbackModel.updateMany(
        { prediction_id: history._id },
        { $set: { isDeleted: true } },
      );
    }
  }

  async findHistoriesByBreedName(breedName: string, limit: number = 10) {
    const breedRegex = new RegExp(breedName.replace(/-/g, ' '), 'i');
    return this.predictionHistoryModel
      .find({ 'predictions.class': { $regex: breedRegex } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('processedMediaPath')
      .lean();
  }
}
