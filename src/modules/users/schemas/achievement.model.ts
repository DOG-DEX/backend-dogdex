import mongoose, { Schema, Document } from 'mongoose';

const i18nStringSchema = new Schema(
  {
    en: { type: String, required: true },
    vi: { type: String, required: true },
  },
  { _id: false },
);

export interface AchievementDoc extends Document {
  key: string;
  name: { en: string; vi: string };
  description: { en: string; vi: string };
  condition: {
    type: 'collection_count' | 'rare_breed' | 'all_breeds' | 'custom';
    value: number;
    breedSlug?: string;
  };
  icon?: string;
  isDeleted: boolean;
}

export const AchievementSchema = new Schema<AchievementDoc>(
  {
    key: { type: String, required: true, unique: true },
    name: { type: i18nStringSchema, required: true },
    description: { type: i18nStringSchema, required: true },
    condition: {
      type: {
        type: String,
        enum: ['collection_count', 'rare_breed', 'all_breeds', 'custom'],
        required: true,
      },
      value: { type: Number, required: true },
      breedSlug: { type: String },
    },
    icon: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'achievements',
  },
);

export const AchievementModel = mongoose.model<AchievementDoc>('Achievement', AchievementSchema);
