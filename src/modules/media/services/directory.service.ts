import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DirectoryDoc } from '../schemas/directory.model';
import { MediaDoc } from '../schemas/medias.model';

@Injectable()
export class DirectoryService {
  constructor(
    @InjectModel('Directory') private directoryModel: Model<DirectoryDoc>,
    @InjectModel('Media') private mediaModel: Model<MediaDoc>,
  ) {}

  async create(
    data: { name: string; parent_id: string | null },
    creator_id: string,
  ): Promise<DirectoryDoc> {
    if (data.parent_id) {
      const parent = await this.directoryModel.findOne({
        _id: data.parent_id,
        creator_id,
        isDeleted: false,
      });
      if (!parent) throw new NotFoundException('Parent directory not found');
    }
    const newDirectory = new this.directoryModel({
      ...data,
      creator_id: new Types.ObjectId(creator_id),
    });
    return newDirectory.save();
  }

  async ensureDirectory(
    name: string,
    parent_id: string | null,
    creator_id: string,
  ): Promise<DirectoryDoc> {
    const existingDir = await this.directoryModel.findOne({
      name,
      parent_id,
      creator_id: new Types.ObjectId(creator_id),
      isDeleted: false,
    });

    if (existingDir) {
      return existingDir;
    }

    const newDirectory = new this.directoryModel({
      name,
      parent_id,
      creator_id: new Types.ObjectId(creator_id),
    });
    return newDirectory.save();
  }

  async findById(id: string): Promise<DirectoryDoc | null> {
    return this.directoryModel.findOne({ _id: id, isDeleted: false });
  }

  async getChildren(
    creatorId: string,
    parent_id: string | null,
  ): Promise<DirectoryDoc[]> {
    return this.directoryModel
      .find({ creator_id: creatorId, parent_id, isDeleted: false })
      .sort({ name: 'asc' });
  }

  async softDeleteRecursive(directoryId: string): Promise<void> {
    await this.mediaModel.updateMany(
      { directory_id: directoryId, isDeleted: false },
      { $set: { isDeleted: true } },
    );

    const subDirectories = await this.directoryModel.find({
      parent_id: directoryId,
      isDeleted: false,
    });

    if (subDirectories.length > 0) {
      await Promise.all(
        subDirectories.map((subDir) =>
          this.softDeleteRecursive((subDir._id as any).toString()),
        ),
      );
    }

    await this.directoryModel.findByIdAndUpdate(directoryId, {
      $set: { isDeleted: true },
    });
  }

  async getBreadcrumb(directoryId: string): Promise<DirectoryDoc[]> {
    const breadcrumb: DirectoryDoc[] = [];
    let currentId: string | null = directoryId;

    while (currentId) {
      const directory = await this.directoryModel
        .findOne({
          _id: currentId,
          isDeleted: false,
        })
        .select('_id name parent_id');

      if (directory) {
        breadcrumb.unshift(directory);
        currentId = directory.parent_id
          ? (directory.parent_id as string)
          : null;
      } else {
        break;
      }
    }
    return breadcrumb;
  }

  async rename(
    directoryId: string,
    name: string,
  ): Promise<DirectoryDoc | null> {
    return this.directoryModel.findOneAndUpdate(
      { _id: directoryId, isDeleted: false },
      { name },
      { new: true },
    );
  }

  async move(
    directoryId: string,
    parent_id: string | null,
  ): Promise<DirectoryDoc | null> {
    return this.directoryModel.findOneAndUpdate(
      { _id: directoryId, isDeleted: false },
      { parent_id },
      { new: true },
    );
  }

  async getAll(): Promise<DirectoryDoc[]> {
    return this.directoryModel.find({ isDeleted: false }).sort({ name: 'asc' });
  }
}
