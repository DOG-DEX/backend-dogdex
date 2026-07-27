import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlanDoc } from '../schemas/plan.model';

export interface IPlanQuery {
  isDeleted?: boolean;
  isPublic?: boolean;
  slug?: string;
  page?: number;
  limit?: number;
  search?: string;
}

@Injectable()
export class PlanService {
  constructor(@InjectModel('Plan') private planModel: Model<PlanDoc>) {}

  async getAllPaginated(
    query: IPlanQuery = {},
  ): Promise<{ data: PlanDoc[]; pagination: any }> {
    const { page = 1, limit = 10, search, ...filterQuery } = query;
    const finalFilter: any = { isDeleted: false, ...filterQuery };

    if (search) {
      finalFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [plans, total] = await Promise.all([
      this.planModel
        .find(finalFilter)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.planModel.countDocuments(finalFilter),
    ]);

    return {
      data: plans,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPublicPlans(): Promise<PlanDoc[]> {
    return this.planModel.find({ isDeleted: false }).sort({ order: 1 }).exec();
  }

  async getOne(query: IPlanQuery): Promise<PlanDoc | null> {
    const finalQuery = { isDeleted: false, ...query };
    return this.planModel.findOne(finalQuery);
  }

  async getBySlug(slug: string): Promise<PlanDoc> {
    const plan = await this.getOne({ slug, isDeleted: false });
    if (!plan) {
      throw new NotFoundException(`Không tìm thấy gói cước với slug: ${slug}`);
    }
    return plan;
  }

  async create(planData: Partial<PlanDoc>): Promise<PlanDoc> {
    const newPlan = await this.planModel.create(planData);
    return newPlan.toObject() as PlanDoc;
  }

  async update(id: string, updateData: Partial<PlanDoc>): Promise<PlanDoc> {
    const updatedPlan = await this.planModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );
    if (!updatedPlan)
      throw new NotFoundException(
        `Không tìm thấy gói cước với ID: ${id} để cập nhật.`,
      );
    return updatedPlan;
  }

  async softDelete(id: string): Promise<PlanDoc> {
    const deletedPlan = await this.planModel.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true } },
      { new: true },
    );
    if (!deletedPlan)
      throw new NotFoundException(
        `Không tìm thấy gói cước với ID: ${id} để xóa.`,
      );
    return deletedPlan;
  }
}
