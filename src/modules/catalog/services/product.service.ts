import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductDoc } from '../schemas/product.schema';

@Injectable()
export class ProductService {
  constructor(@InjectModel('Product') private readonly productModel: Model<ProductDoc>) {}

  async findAll(page = 1, limit = 20, category?: string) {
    const filter: any = { isDeleted: false, isActive: true };
    if (category) filter.category = category;
    const [data, total] = await Promise.all([
      this.productModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      this.productModel.countDocuments(filter),
    ]);
    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    return this.productModel.findOne({ _id: id, isDeleted: false, isActive: true });
  }

  async create(data: Partial<ProductDoc>) {
    return this.productModel.create(data);
  }

  async update(id: string, data: Partial<ProductDoc>) {
    return this.productModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, { new: true });
  }

  async remove(id: string) {
    return this.productModel.findOneAndUpdate({ _id: id }, { isDeleted: true }, { new: true });
  }
}
