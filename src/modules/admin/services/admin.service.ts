import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { UserDoc } from '../../users/schemas/user.model';
import { PredictionHistoryDoc } from '../../predictions/schemas/prediction_history.model';
import { AnalyticsEventDoc } from '../../analytics/schemas/analytics_event.model';
import { MediaDoc } from '../../media/schemas/medias.model';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('PredictionHistory')
    private historyModel: Model<PredictionHistoryDoc>,
    @InjectModel('AnalyticsEvent')
    private analyticsModel: Model<AnalyticsEventDoc>,
    @InjectModel('Media') private mediaModel: Model<MediaDoc>,
  ) {}

  async getDashboardData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalUsers, totalPredictions, todayPredictions, totalMedias] =
      await Promise.all([
        this.userModel.countDocuments({ isDeleted: { $ne: true } }),
        this.historyModel.countDocuments({ isDeleted: { $ne: true } }),
        this.historyModel.countDocuments({
          createdAt: { $gte: today },
          isDeleted: { $ne: true },
        }),
        this.mediaModel.countDocuments({ isDeleted: { $ne: true } }),
      ]);

    const weeklyActivity = await this.historyModel.aggregate([
      {
        $match: { createdAt: { $gte: sevenDaysAgo }, isDeleted: { $ne: true } },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          predictions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topBreeds = await this.historyModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $unwind: '$predictions' },
      { $group: { _id: '$predictions.class', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { breed: '$_id', count: 1, _id: 0 } },
    ]);

    return {
      stats: {
        totalUsers,
        totalPredictions,
        todayPredictions,
        totalMedias,
      },
      weeklyActivity,
      topBreeds,
    };
  }

  async getAllUsers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const filter: any = { isDeleted: { $ne: true } };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { full_name: searchRegex },
      ];
    }

    const users = await this.userModel
      .find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await this.userModel.countDocuments(filter);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId: string, role: string) {
    const validRoles = ['user', 'member', 'de', 'admin'];

    if (!validRoles.includes(role)) {
      throw new BadRequestException(
        `Vai trò không hợp lệ: '${role}'. Các vai trò hợp lệ gồm: ${validRoles.join(', ')}`,
      );
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { role }, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    return user;
  }

  async toggleUserBlock(userId: string, isBlocked: boolean) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { isBlocked }, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    return user;
  }

  async getPredictionAuditLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const filter = { isDeleted: { $ne: true } };

    const logs = await this.historyModel
      .find(filter)
      .populate('user', 'username email full_name')
      .populate('media')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await this.historyModel.countDocuments(filter);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
