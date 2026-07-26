import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserCollectionDoc } from '../../users/schemas/user_collection.model';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { redisClient } from '../../../utils/redis.util';

const CACHE_TTL = 60 * 15; // 15 minutes

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  avatarPath?: string;
  role?: string;
  country?: string;
  city?: string;
  totalCollected: number;
  rank: number;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectModel('UserCollection') private readonly userCollectionModel: Model<UserCollectionDoc>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getLeaderboard(
    scope: 'global' | 'country' | 'city',
    value: string | null = null,
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    const cleanValue = value ? value.trim().toUpperCase().replace(/\s+/g, '_') : 'ALL';
    const cacheKey = `leaderboard:${scope}:${cleanValue}:top${limit}`;
    const lockKey = `${cacheKey}:lock`;
    const waitInterval = 200;
    const maxRetries = 50;

    if (redisClient) {
      let attempts = 0;
      while (attempts < maxRetries) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) return JSON.parse(cached);

          const acquired = await redisClient.set(lockKey, 'locked', { NX: true, EX: 15 });
          if (acquired) break;

          await new Promise((r) => setTimeout(r, waitInterval));
          attempts++;
        } catch {
          break;
        }
      }
    }

    const pipeline: any[] = [
      { $match: { isDeleted: { $ne: true } } },
      { $addFields: { collectionSize: { $size: '$collectedBreeds' } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: '$userInfo' },
      { $match: { 'userInfo.isDeleted': false } },
      { $match: { 'userInfo.role': { $nin: ['admin', 'dev'] } } },
    ];

    if (scope === 'country' && value) {
      pipeline.push({ $match: { 'userInfo.country': { $regex: new RegExp(`^${value}$`, 'i') } } });
    } else if (scope === 'city' && value) {
      pipeline.push({ $match: { 'userInfo.city': { $regex: new RegExp(`^${value}$`, 'i') } } });
    }

    pipeline.push({ $sort: { collectionSize: -1, updatedAt: 1 } });
    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 0,
        userId: '$userInfo._id',
        username: '$userInfo.username',
        firstName: '$userInfo.firstName',
        lastName: '$userInfo.lastName',
        avatarPath: '$userInfo.avatarPath',
        role: '$userInfo.role',
        country: '$userInfo.country',
        city: '$userInfo.city',
        totalCollected: '$collectionSize',
      },
    });

    const result = await this.userCollectionModel.aggregate(pipeline);

    const leaderboard: LeaderboardEntry[] = result.map((item, index) => ({
      userId: item.userId.toString(),
      username: item.username,
      displayName: item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.username,
      avatarUrl: item.avatarPath ? this.cloudinaryService.buildUrl(item.avatarPath) : undefined,
      role: item.role,
      country: item.country,
      city: item.city,
      totalCollected: item.totalCollected,
      rank: index + 1,
    }));

    if (redisClient) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(leaderboard), { EX: CACHE_TTL });
        await redisClient.del(lockKey);
      } catch { /* ignore */ }
    }

    return leaderboard;
  }

  async getLocations(type: 'country' | 'city'): Promise<string[]> {
    const cacheKey = `leaderboard:locations:${type}`;
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* ignore */ }
    }

    const result = await this.userCollectionModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: '$userInfo' },
      { $match: { 'userInfo.isDeleted': false } },
      { $group: { _id: type === 'country' ? '$userInfo.country' : '$userInfo.city' } },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } },
    ]);

    const locations = result.map((item) => item._id);
    if (redisClient) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(locations), { EX: 3600 });
      } catch { /* ignore */ }
    }
    return locations;
  }
}
