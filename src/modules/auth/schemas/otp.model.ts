import mongoose, { Document, Schema, Types } from 'mongoose';

export enum OtpType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export type OtpDoc = Document & {
  _id: Types.ObjectId;
  email: string;
  otpHash: string;
  type: OtpType;
  expiresAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const otpSchema = new Schema<OtpDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    // A six-digit OTP must never be stored in plaintext.
    otpHash: { type: String, required: true, select: false },
    type: { type: String, enum: Object.values(OtpType), required: true },
    expiresAt: { type: Date, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    collection: 'otps',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        delete ret.otpHash;
        delete ret.isDeleted;
      },
    },
  },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = mongoose.model<OtpDoc>('Otp', otpSchema);
