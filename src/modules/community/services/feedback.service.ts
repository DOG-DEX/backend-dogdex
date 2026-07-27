import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as path from 'path';

import { FeedbackDoc } from '../schemas/feedback.model';
import { PredictionHistoryDoc } from '../../predictions/schemas/prediction_history.model';
import { UserDoc } from '../../users/schemas/user.model';
import { MediaDoc } from '../../media/schemas/medias.model';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { MailService } from '../../../shared/mail/mail.service';
import { logger } from '../../../common/utils/logger.util';

export interface QueryFilters {
  status?: string;
  username?: string;
  submittedLabel?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel('Feedback') private feedbackModel: Model<FeedbackDoc>,
    @InjectModel('PredictionHistory') private predictionHistoryModel: Model<PredictionHistoryDoc>,
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('Media') private mediaModel: Model<MediaDoc>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

  async submitFeedback(
    userId: string,
    data: { prediction_id: string; isCorrect: boolean; user_submitted_label?: string; notes?: string; file_path?: string },
  ) {
    const { prediction_id, isCorrect, user_submitted_label, notes } = data;

    if (!userId) throw new UnauthorizedException('Bạn phải đăng nhập để gửi phản hồi.');

    const prediction = await this.predictionHistoryModel.findById(prediction_id);
    if (!prediction) throw new NotFoundException('Không tìm thấy lịch sử dự đoán.');

    if (prediction.user?.toString() !== userId.toString()) throw new BadRequestException('Bạn không có quyền đánh giá kết quả này.');

    const existingFeedback = await this.feedbackModel.findOne({ prediction_id });
    if (existingFeedback) throw new BadRequestException('Bạn đã gửi phản hồi cho kết quả này rồi.');

    const file_path = data.file_path || prediction.mediaPath;
    if (!file_path) throw new BadRequestException('Không tìm thấy đường dẫn file cho phản hồi này.');

    let final_file_path = file_path;

    if (prediction.source === 'image_upload' && file_path) {
      const from_public_id = file_path.substring(0, file_path.lastIndexOf('.')) || file_path;
      const to_public_id = `dataset/pending/${path.basename(from_public_id)}`;

      try {
        logger.info(`[Feedback Service] Moving Cloudinary resource from '${from_public_id}' to '${to_public_id}'`);
        await this.cloudinaryService.moveAsset(from_public_id, to_public_id);
        const fileExtension = path.extname(file_path);
        const final_file_path_with_ext = `${to_public_id}${fileExtension}`;

        if (prediction.media) {
          await this.mediaModel.updateOne({ _id: (prediction.media as any)._id || prediction.media }, { $set: { mediaPath: final_file_path_with_ext } });
        }
        await this.predictionHistoryModel.updateOne({ _id: prediction._id }, { $set: { mediaPath: final_file_path_with_ext } });
      } catch (error: any) {
        logger.warn(`[Feedback Service] Could not move Cloudinary resource. Error: ${error.message}`);
      }
    }

    const predictionAfterUpdate = await this.predictionHistoryModel.findById(prediction._id);
    const final_path_for_feedback = predictionAfterUpdate?.mediaPath || file_path;

    const feedback = await this.feedbackModel.create({
      prediction_id: new Types.ObjectId(prediction_id),
      user_id: new Types.ObjectId(userId),
      isCorrect,
      user_submitted_label,
      notes,
      file_path: final_path_for_feedback,
      status: 'pending_review',
    });

    const user = await this.userModel.findById(userId).select('email username firstName');
    if (user?.email) {
      this.mailService.sendFeedbackThankYouEmail({
        to: user.email,
        userName: user.firstName || user.username,
        breedLabel: user_submitted_label || 'Dog',
        language: 'vi',
      }).catch((e) => logger.error('Failed to send feedback thank you email:', e));
    }

    return feedback;
  }

  async getFeedbacks(filters: QueryFilters, pagination: { page: number; limit: number }) {
    const { status, username, submittedLabel, startDate, endDate } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (status) query.status = status;
    if (submittedLabel) query.user_submitted_label = { $regex: submittedLabel, $options: 'i' };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (username) {
      const users = await this.userModel.find({ username: { $regex: username, $options: 'i' } }).select('_id');
      const userIds = users.map((u) => u._id);
      if (userIds.length === 0) return { data: [], total: 0, page, limit, totalPages: 0 };
      query.user_id = { $in: userIds };
    }

    const feedbacks = await this.feedbackModel
      .find(query)
      .populate('user_id', 'username')
      .populate('prediction_id')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await this.feedbackModel.countDocuments(query);

    return { data: feedbacks, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAdminFeedbackPageData(filters: QueryFilters, pagination: { page: number; limit: number }) {
    const [feedbackResult, statsResult] = await Promise.all([
      this.getFeedbacks(filters, pagination),
      this.feedbackModel.aggregate([
        {
          $facet: {
            overallStats: [
              { $match: { isDeleted: false } },
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            userStats: [
              { $match: { isDeleted: false } },
              {
                $group: {
                  _id: '$user_id',
                  total: { $sum: 1 },
                  approved: { $sum: { $cond: [{ $eq: ['$status', 'approved_for_training'] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                },
              },
              { $sort: { total: -1 } },
              { $limit: 10 },
              { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
              { $unwind: '$user' },
              { $project: { _id: 0, userId: '$_id', username: '$user.username', totalSubmissions: '$total', approvedCount: '$approved', rejectedCount: '$rejected' } },
            ],
          },
        },
      ]),
    ]);

    const stats: any = { pending_review: 0, approved_for_training: 0, rejected: 0 };
    (statsResult[0]?.overallStats || []).forEach((stat: any) => {
      if (stats[stat._id] !== undefined) {
        stats[stat._id] = stat.count;
      }
    });

    return { stats, userStats: statsResult[0]?.userStats || [], feedbacks: feedbackResult };
  }

  async getFeedbackById(id: string) {
    const feedback = await this.feedbackModel
      .findById(id)
      .populate({ path: 'prediction_id', populate: { path: 'media' } })
      .populate('user_id', 'username email');
    if (!feedback) throw new NotFoundException('Không tìm thấy feedback.');
    return feedback;
  }

  async updateFeedback(id: string, data: { status: string; admin_id?: string; reason?: string }, correctedLabel?: string) {
    const feedback = await this.feedbackModel.findById(id).populate('prediction_id', 'predictions');
    if (!feedback) throw new NotFoundException('Không tìm thấy feedback để cập nhật.');

    feedback.status = data.status as any;
    if (data.admin_id) feedback.admin_id = new Types.ObjectId(data.admin_id) as any;
    if (data.reason) feedback.reason = data.reason;

    await feedback.save();
    return feedback;
  }

  async deleteFeedback(id: string, force = false) {
    const feedback = await this.feedbackModel.findById(id);
    if (!feedback) throw new NotFoundException('Không tìm thấy feedback.');

    if (force) {
      await this.predictionHistoryModel.updateOne({ _id: feedback.prediction_id }, { $set: { isCorrect: null } });
      await feedback.deleteOne();
      return { message: 'Feedback đã được xóa vĩnh viễn.' };
    }

    feedback.isDeleted = true;
    await feedback.save();
    return { message: 'Feedback đã được xóa mềm.' };
  }

  async approveFeedback(id: string, adminId: string, correctedLabel?: string): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id);
    if (feedback.status !== 'pending_review') throw new BadRequestException('Feedback này đã được xử lý.');

    if (correctedLabel && correctedLabel.trim() !== '') {
      feedback.user_submitted_label = correctedLabel.trim();
      feedback.isCorrect = false;
    }

    const updatedFeedback = await this.updateFeedback(id, { status: 'approved_for_training', admin_id: adminId }, correctedLabel);
    await updatedFeedback.populate('user_id', 'username email');

    const predictionId = (updatedFeedback.prediction_id as any)._id;
    await this.predictionHistoryModel.updateOne({ _id: predictionId }, { $set: { isCorrect: updatedFeedback.isCorrect } });
    return updatedFeedback;
  }

  async rejectFeedback(id: string, adminId: string, reason?: string): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id);
    if (feedback.status !== 'pending_review') throw new BadRequestException('Feedback này đã được xử lý.');

    const updatedFeedback = await this.updateFeedback(id, { status: 'rejected', admin_id: adminId, reason });
    await updatedFeedback.populate('user_id', 'username email');

    const predictionId = (updatedFeedback.prediction_id as any)._id;
    await this.predictionHistoryModel.updateOne({ _id: predictionId }, { $set: { isCorrect: true } });
    return updatedFeedback;
  }
}
