import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PetDoc } from '../schemas/pet.schema';

@Injectable()
export class PetService {
  constructor(@InjectModel('Pet') private readonly petModel: Model<PetDoc>) {}

  async findByOwner(ownerId: string) {
    return this.petModel.find({ owner: new Types.ObjectId(ownerId), isDeleted: false });
  }

  async findById(id: string) {
    return this.petModel.findOne({ _id: id, isDeleted: false }).populate('owner', '-password');
  }

  async findByQrCode(qrCode: string) {
    return this.petModel.findOne({ qrCode, isDeleted: false });
  }

  async create(data: Partial<PetDoc>) {
    return this.petModel.create(data);
  }

  async update(id: string, ownerId: string, data: Partial<PetDoc>) {
    return this.petModel.findOneAndUpdate(
      { _id: id, owner: new Types.ObjectId(ownerId), isDeleted: false },
      data,
      { new: true },
    );
  }

  async remove(id: string, ownerId: string) {
    return this.petModel.findOneAndUpdate(
      { _id: id, owner: new Types.ObjectId(ownerId) },
      { isDeleted: true },
      { new: true },
    );
  }
}
