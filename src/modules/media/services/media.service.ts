import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MediaDoc } from '../schemas/medias.model';
import { DirectoryDoc } from '../schemas/directory.model';
import * as path from 'path';
import * as fs from 'fs/promises';
import { cloudinary } from '../../../config/cloudinary.config';
import { logger } from '../../../utils/logger.util';

export interface FindMediasOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  directory_id?: string | null;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectModel('Media') private mediaModel: Model<MediaDoc>,
    @InjectModel('Directory') private directoryModel: Model<DirectoryDoc>
  ) {}

  async createMedia(mediaData: any): Promise<MediaDoc> {
    return this.mediaModel.create(mediaData);
  }

  async updateInfoMedia(_id: string, data: any): Promise<MediaDoc | null> {
    return this.mediaModel.findOneAndUpdate(
      { _id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  async softDeleteMedia(_id: string): Promise<MediaDoc | null> {
    const media = await this.mediaModel.findOneAndUpdate(
      { _id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    return media;
  }

  async moveMedia(mediaId: string, newDirectoryId: string | null): Promise<MediaDoc | null> {
    const media = await this.mediaModel.findById(mediaId);
    if (!media) return null;

    const oldPublicIdWithExt = media.mediaPath;
    const oldPublicId = oldPublicIdWithExt.substring(0, oldPublicIdWithExt.lastIndexOf('.')) || oldPublicIdWithExt;
    const fileExtension = path.extname(oldPublicIdWithExt);
    const fileName = path.basename(oldPublicId);

    const buildFullPath = async (dirId: string | null): Promise<string> => {
      if (!dirId) return 'public/uploads';
      let current = await this.directoryModel.findById(dirId);
      if (!current) return 'public/uploads';
      let parts = [current.name];
      while (current && current.parent_id) {
        current = await this.directoryModel.findById(current.parent_id);
        if (current) parts.unshift(current.name);
      }
      return `public/uploads/${parts.join('/')}`;
    };

    const newFolderPath = await buildFullPath(newDirectoryId);
    const newPublicId = `${newFolderPath}/${fileName}`;

    if (oldPublicId !== newPublicId) {
      try {
        logger.info(`[Media Service] Moving Cloudinary resource from '${oldPublicId}' to '${newPublicId}'`);
        const renameResult = await cloudinary.uploader.rename(oldPublicId, newPublicId, { overwrite: true });
        
        await cloudinary.uploader.explicit(renameResult.public_id, {
          type: 'upload',
          asset_folder: newFolderPath
        });
      } catch (error: any) {
        if (error.http_code !== 422) {
          logger.error(`[Media Service] Failed to move Cloudinary file:`, error.message);
          throw error;
        }
        logger.warn(`[Media Service] Destination '${newPublicId}' already exists.`);
      }
    }

    media.directory_id = newDirectoryId as any;
    media.mediaPath = `${newPublicId}${fileExtension}`;
    return media.save();
  }
  
  async findAndPaginate(options: FindMediasOptions): Promise<{ data: MediaDoc[]; pagination: any }> {
    const { page = 1, limit = 50, search, type, directory_id, startDate, endDate } = options;

    const filter: any = { isDeleted: false };
    if (directory_id !== undefined) filter.directory_id = directory_id;
    if (search) filter.name = new RegExp(search, "i");
    if (type) filter.type = new RegExp(`^${type}/`, "i");

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        if (!isNaN(start.getTime())) filter.createdAt.$gte = start;
        else throw new BadRequestException("Invalid startDate format. Expected format: YYYY-MM-DD");
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999Z`);
        if (!isNaN(end.getTime())) filter.createdAt.$lt = end;
        else throw new BadRequestException("Invalid endDate format. Expected format: YYYY-MM-DD");
      }
    }
    const sortOptions: any = { createdAt: -1 };
    const [totalItems, data] = await Promise.all([
      this.mediaModel.countDocuments(filter),
      this.mediaModel.find(filter)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    const totalPages = Math.ceil(totalItems / limit);
    return {
      data,
      pagination: { totalItems, totalPages, currentPage: page, limit },
    };
  }

  async findById(id: string): Promise<MediaDoc | null> {
    return this.mediaModel.findOne({ _id: id, isDeleted: false });
  }

  async getFileTypeFolders(): Promise<string[]> {
    const UPLOADS_DIR = path.join(process.cwd(), "uploads");
    try {
      const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((d) => d.name);
    } catch {
      return [];
    }
  }

  async getYearFolders(fileType: string): Promise<string[]> {
    const typePath = path.join(process.cwd(), "uploads", fileType);
    try {
      const entries = await fs.readdir(typePath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))
        .map((d) => d.name)
        .sort((a, b) => b.localeCompare(a));
    } catch {
      return [];
    }
  }

  async getMonthFolders(fileType: string, year: string): Promise<string[]> {
    const yearPath = path.join(process.cwd(), "uploads", fileType, year);
    try {
      const entries = await fs.readdir(yearPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && /^(0[1-9]|1[0-2])$/.test(e.name))
        .map((d) => d.name)
        .sort((a, b) => b.localeCompare(a));
    } catch {
      return [];
    }
  }

  async findAndPaginateByPhysicalPath(fileType: string, year: string, month: string, options: { page?: number; limit?: number; search?: string }): Promise<{ data: MediaDoc[]; pagination: any }> {
    const { page = 1, limit = 50, search } = options;

    const pathRegex = new RegExp(`^uploads(\\\\|/)${fileType}(\\\\|/)${year}(\\\\|/)${month}(\\\\|/)`, "i");

    const filter: any = {
      isDeleted: false,
      mediaPath: pathRegex,
    };

    if (search) {
      filter.name = new RegExp(search, "i");
    }

    const sortOptions: any = { createdAt: -1 };

    const [totalItems, data] = await Promise.all([
      this.mediaModel.countDocuments(filter),
      this.mediaModel.find(filter)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    return {
      data,
      pagination: { totalItems, totalPages, currentPage: page, limit },
    };
  }
}
