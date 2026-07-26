import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReportTargetType = 'post' | 'comment' | 'user';
export type ReportStatus = 'pending' | 'approved' | 'rejected';

export type ModerationReportDoc = Document & {
  reporterId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reason: string;
  status: ReportStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const reportSchema = new Schema<ModerationReportDoc>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'comment', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true, collection: 'moderation_reports' },
);

reportSchema.index({ status: 1, createdAt: -1 });

export const ModerationReportModel = mongoose.model<ModerationReportDoc>('ModerationReport', reportSchema);
