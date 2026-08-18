import mongoose, { Schema, Document } from 'mongoose';

export interface HealthRecordDoc extends Document {
  dog_id: string;
  type: 'vaccine' | 'checkup' | 'medicine' | 'surgery' | 'hygiene' | 'other';
  title: string;
  date: Date;
  nextDueDate?: Date;
  reminderSent?: boolean;
  notes?: string;

  vetName?: string;
  vetClinic?: string;
  cost?: number;
  weight?: number; // kg
  symptoms?: string;
  diagnosis?: string;

  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const healthRecordSchema = new Schema(
  {
    dog_id: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['vaccine', 'checkup', 'medicine', 'surgery', 'hygiene', 'other'],
      default: 'checkup',
    },
    title: { type: String, required: true },
    date: { type: Date, required: true },
    nextDueDate: { type: Date },
    reminderSent: { type: Boolean, default: false },
    notes: { type: String },

    vetName: { type: String },
    vetClinic: { type: String },
    cost: { type: Number, min: 0 },
    weight: { type: Number, min: 0 },
    symptoms: { type: String },
    diagnosis: { type: String },

    attachments: [{ type: String }],
  },
  {
    timestamps: true,
    collection: 'health_records',
    toJSON: {
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  },
);

export const HealthRecordModel =
  mongoose.models.HealthRecord ||
  mongoose.model<HealthRecordDoc>('HealthRecord', healthRecordSchema);
