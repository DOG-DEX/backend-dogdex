import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CommunityPostDoc, PostType, PostStatus } from '../schemas/community_post.model';
import { PredictionService } from '../../predictions/services/prediction.service';
import { MatchingService } from './matching.service';

import { slugify } from '../../../common/utils/slugify.util';

const toSlug = slugify;

export interface CreatePostDTO {
  type: PostType;
  title: string;
  content: string;
  photos?: string[];
  dog_id?: string;
  location?: {
      lat: number;
      lng: number;
      address: string;
  };
  contact_info: {
      name: string;
      phone?: string;
      email?: string;
  };
}

export interface FilterOptions {
  type?: PostType;
  breed?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: PostStatus;
  lat?: number;
  lng?: number;
  radius?: number; // km
}

@Injectable()
export class PostService {
  constructor(
    @InjectModel('CommunityPost') private communityPostModel: Model<CommunityPostDoc>,
    @InjectModel('DogProfile') private dogProfileModel: Model<any>,
    private readonly predictionService: PredictionService,
    private readonly matchingService: MatchingService
  ) {}

  async createPost(data: CreatePostDTO, authorId: string, req: any, trustedAiMetadata?: any): Promise<CommunityPostDoc> {
    let aiMetadata: {
      breed: string;
      breed_slug: string;
      confidence: number;
      color: string;
      verificationType?: 'camera' | 'qr';
    } = {
      breed: "Unknown",
      breed_slug: "unknown",
      confidence: 0,
      color: "Unknown"
    };

    if (trustedAiMetadata) {
      aiMetadata = trustedAiMetadata;
    } else if (data.dog_id) {
      const linkedDog = await this.dogProfileModel.findById(data.dog_id);
      if (linkedDog) {
        aiMetadata = {
          breed: linkedDog.breed,
          breed_slug: toSlug(linkedDog.breed),
          confidence: 1.0,
          color: linkedDog.attributes?.color || "Unknown",
          verificationType: 'qr' as const
        };
        if (!data.photos || data.photos.length === 0) {
          data.photos = linkedDog.photos?.length > 0
              ? linkedDog.photos
              : (linkedDog.avatarPath ? [linkedDog.avatarPath] : []);
        }
      } else {
        throw new BadRequestException("Linked dog profile not found.");
      }
    } else {
      if (!data.photos || data.photos.length === 0) {
        throw new BadRequestException("Post must have at least one photo for AI verification.");
      }

      const mainPhotoUrl = data.photos[0];

      try {
        const predictionHistory = await this.predictionService.makeUrlPrediction(authorId, mainPhotoUrl, req);

        if (!predictionHistory.predictions || predictionHistory.predictions.length === 0) {
          throw new BadRequestException("AI did not detect any dog in the image. Please upload a clear dog photo.");
        }

        const topPrediction = predictionHistory.predictions[0];

        if (topPrediction.confidence < 0.4) {
          throw new BadRequestException("The image is not clear enough or does not contain a dog (Low confidence).");
        }

        aiMetadata = {
          breed: topPrediction.class,
          breed_slug: toSlug(topPrediction.class),
          confidence: topPrediction.confidence,
          color: "Unknown"
        };
      } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException("AI Verification failed. Could not process image.");
      }
    }

    const locationGeoJSON = data.location ? {
      type: "Point" as const,
      coordinates: [data.location.lng, data.location.lat],
      address: data.location.address
    } : undefined;

    if (!locationGeoJSON) throw new BadRequestException("Location is required.");

    const post = await this.communityPostModel.create({
      author_id: authorId,
      type: data.type,
      status: PostStatus.OPEN,
      title: data.title,
      content: data.content,
      photos: data.photos,
      dog_id: data.dog_id,
      location: locationGeoJSON,
      contact_info: data.contact_info,
      ai_metadata: aiMetadata
    });

    this.matchingService.findPotentialMatches({
      type: post.type,
      breed: aiMetadata.breed,
      longitude: locationGeoJSON.coordinates[0],
      latitude: locationGeoJSON.coordinates[1],
      distanceInKm: 10,
      authorId: authorId
    }).then(matches => {
      if (matches.length > 0) {
        console.log(`[MatchingService] Found ${matches.length} potential matches for Post ${post._id}. Email sent to author.`);
      }
    });

    return post;
  }

  async getPosts(filters: FilterOptions, page: number = 1, limit: number = 20, view: string = 'list'): Promise<{ data: CommunityPostDoc[], total: number }> {
    const query: any = {
      status: filters.status || PostStatus.OPEN,
      isDeleted: { $ne: true }
    };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.breed) {
      query["ai_metadata.breed_slug"] = toSlug(filters.breed);
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query["sale_info.price"] = {};
      if (filters.minPrice !== undefined) query["sale_info.price"].$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query["sale_info.price"].$lte = filters.maxPrice;
    }

    let isGeospatial = false;
    const countQuery = { ...query };

    if (filters.lat && filters.lng && filters.radius) {
      isGeospatial = true;
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [filters.lng, filters.lat]
          },
          $maxDistance: filters.radius * 1000
        }
      };

      countQuery.location = {
        $geoWithin: {
          $centerSphere: [
            [filters.lng, filters.lat],
            filters.radius / 6378.1
          ]
        }
      };
    }

    const skip = (page - 1) * limit;
    let dbQuery = this.communityPostModel.find(query);

    if (!isGeospatial) {
      dbQuery = dbQuery.sort({ createdAt: -1 });
    }

    if (view === 'map_radar') {
      dbQuery.select("location type ai_metadata photos createdAt _id");
    }

    dbQuery = dbQuery.skip(skip).limit(limit);

    const [data, total] = await Promise.all([
      dbQuery,
      this.communityPostModel.countDocuments(countQuery)
    ]);

    return { data, total };
  }

  async getRadarPosts(lat: number, lng: number, radius: number = 10, breed?: string, sourceType?: PostType): Promise<CommunityPostDoc[]> {
    const targetType = sourceType === PostType.FOUND ? PostType.LOST : PostType.FOUND;

    const query: any = {
      status: PostStatus.OPEN,
      type: targetType,
      isDeleted: { $ne: true }
    };

    if (breed) {
      query["ai_metadata.breed_slug"] = toSlug(breed);
    }

    query.location = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat]
        },
        $maxDistance: radius * 1000
      }
    };

    return await this.communityPostModel.find(query)
      .select("location type ai_metadata photos createdAt _id title contact_info")
      .limit(50);
  }

  async getPostById(id: string): Promise<CommunityPostDoc | null> {
    const post = await this.communityPostModel.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate("dog_id");
    return post;
  }

  async updatePost(id: string, authorId: string, updateData: Partial<CommunityPostDoc>): Promise<CommunityPostDoc> {
    const post = await this.communityPostModel.findById(id);
    if (!post) throw new NotFoundException("Post not found");
    if (!post.author_id || post.author_id.toString() !== authorId) throw new UnauthorizedException();

    Object.assign(post, updateData);
    await post.save();
    return post;
  }

  async deletePost(id: string, authorId: string): Promise<void> {
    const post = await this.communityPostModel.findById(id);
    if (!post) throw new NotFoundException("Post not found");
    if (!post.author_id || post.author_id.toString() !== authorId) throw new UnauthorizedException();

    await post.deleteOne();
  }

  async markAsResolved(id: string, authorId: string): Promise<CommunityPostDoc> {
    const post = await this.communityPostModel.findById(id);
    if (!post) throw new NotFoundException("Post not found");
    if (!post.author_id || post.author_id.toString() !== authorId) throw new UnauthorizedException();

    post.status = PostStatus.RESOLVED;
    post.isDeleted = true;
    await post.save();

    if (post.type === PostType.LOST && post.dog_id) {
      await this.dogProfileModel.findByIdAndUpdate(post.dog_id, { isLost: false });
    }

    return post;
  }

  async resolvePostsByDogId(dogId: string): Promise<void> {
    await this.communityPostModel.updateMany(
      { dog_id: dogId, status: PostStatus.OPEN },
      {
        $set: {
          status: PostStatus.RESOLVED,
          isDeleted: true
        }
      }
    );
  }
}
