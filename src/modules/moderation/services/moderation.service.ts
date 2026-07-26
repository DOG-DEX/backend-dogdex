import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ModerationReportDoc, ReportStatus } from '../schemas/moderation-report.schema';

@Injectable()
export class ModerationService {
  constructor(
    @InjectModel('ModerationReport') private readonly reportModel: Model<ModerationReportDoc>,
  ) {}

  async createReport(reporterId: string, targetType: string, targetId: string, reason: string) {
    return this.reportModel.create({
      reporterId: new Types.ObjectId(reporterId),
      targetType: targetType as any,
      targetId: new Types.ObjectId(targetId),
      reason,
    });
  }

  async getPendingReports(page = 1, limit = 20) {
    const filter: any = { status: 'pending' };
    const [data, total] = await Promise.all([
      this.reportModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('reporterId', 'name email'),
      this.reportModel.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async review(reportId: string, reviewerId: string, status: ReportStatus) {
    return this.reportModel.findByIdAndUpdate(
      reportId,
      { status, reviewedBy: new Types.ObjectId(reviewerId), reviewedAt: new Date() },
      { new: true },
    );
  }
}
