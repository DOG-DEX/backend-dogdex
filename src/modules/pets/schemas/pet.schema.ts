import mongoose, { Schema, Document, Types } from 'mongoose';

export type PetDoc = Document & {
  name: string;
  breed?: string;
  age?: number;
  owner: Types.ObjectId;
  qrCode?: string;
  photos: string[];
  linkedProducts: Types.ObjectId[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const petSchema = new Schema<PetDoc>(
  {
    name: { type: String, required: true, trim: true },
    breed: { type: String },
    age: { type: Number },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    qrCode: { type: String, unique: true, sparse: true },
    photos: [{ type: String }],
    linkedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    isDeleted: { type: Boolean, default: false, select: false },
  },
  { timestamps: true, collection: 'pets' },
);

export const PetModel = mongoose.model<PetDoc>('Pet', petSchema);
