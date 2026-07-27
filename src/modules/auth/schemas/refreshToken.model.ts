import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserDoc } from '../../users/schemas/user.model';

export type RefreshTokenDoc = Document & {
  user: Types.ObjectId | UserDoc;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  isDeleted: boolean;
};

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jti: { type: String, required: true, unique: true },
    // Never store a bearer token itself. A hash lets us revoke and rotate it safely.
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, select: false },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'refresh_tokens',
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
        delete ret.tokenHash;
      },
    },
  },
);

refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<RefreshTokenDoc>(
  'RefreshToken',
  refreshTokenSchema,
);
