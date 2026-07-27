import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserCollectionDoc } from '../schemas/user_collection.model';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
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
    @InjectModel('UserCollection') private userCollectionModel: Model<UserCollectionDoc>,
  ) {}

  async getLeaderboard(
    scope: 'global' | 'country' | 'city' = 'global',
    value: string | null = null,
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    const pipeline: any[] = [];
    pipeline.push({ $match: { isDeleted: { $ne: true } } });
    pipeline.push({ $addFields: { collectionSize: { $size: { $ifNull: ['$collectedBreeds', []] } } } });
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'userInfo',
      },
    });
    pipeline.push({ $unwind: '$userInfo' });
    pipeline.push({ $match: { 'userInfo.isDeleted': false } });
    pipeline.push({ $match: { 'userInfo.role': { $nin: ['admin', 'dev'] } } });

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
        full_name: '$userInfo.full_name',
        avatarPath: '$userInfo.avatarPath',
        avatar: '$userInfo.avatar',
        role: '$userInfo.role',
        country: '$userInfo.country',
        city: '$userInfo.city',
        totalCollected: '$collectionSize',
      },
    });

    const result = await this.userCollectionModel.aggregate(pipeline);

    return result.map((item, index) => ({
      userId: item.userId?.toString(),
      username: item.username,
      displayName: item.full_name || (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.username),
      avatarPath: item.avatarPath || item.avatar,
      role: item.role,
      country: item.country,
      city: item.city,
      totalCollected: item.totalCollected,
      rank: index + 1,
    }));
  }

  async getLocations(type: 'country' | 'city'): Promise<string[]> {
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

    return result.map((item) => item._id);
  }
}
