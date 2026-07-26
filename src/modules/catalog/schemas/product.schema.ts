import mongoose, { Schema, Document } from 'mongoose';

export type ProductDoc = Document & {
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  stock: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const productSchema = new Schema<ProductDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    category: { type: String, required: true },
    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, select: false },
  },
  { timestamps: true, collection: 'products' },
);

productSchema.index({ category: 1, isActive: 1 });

export const ProductModel = mongoose.model<ProductDoc>('Product', productSchema);
