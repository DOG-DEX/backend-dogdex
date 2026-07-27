import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserCollectionDoc,
  CollectedBreed,
} from '../schemas/user_collection.model';
import { DogBreedWikiDoc } from '../../dogs/schemas/dogs_wiki.model';
import { PredictionHistoryDoc } from '../../predictions/schemas/prediction_history.model';

export interface DogDexBreed {
  slug: string;
  breed: string;
  group?: string;
  pokedexNumber?: number;
  origin?: string;
  mediaUrl?: string;
  rarity_level?: number;
  isCollected: boolean;
  collectedAt: Date | null;
  source: string | null;
}

@Injectable()
export class UserCollectionService {
  private readonly logger = new Logger(UserCollectionService.name);

  constructor(
    @InjectModel('UserCollection')
    private userCollectionModel: Model<UserCollectionDoc>,
    @InjectModel('DogBreedWikiEn') private wikiEnModel: Model<DogBreedWikiDoc>,
    @InjectModel('DogBreedWikiVi') private wikiViModel: Model<DogBreedWikiDoc>,
  ) {}

  private getWikiModel(lang: 'vi' | 'en' = 'en'): Model<DogBreedWikiDoc> {
    return lang === 'vi' ? this.wikiViModel : this.wikiEnModel;
  }

  async addOrUpdateManyCollections(
    userId: Types.ObjectId,
    breedSlugs: string[],
    predictionId: Types.ObjectId,
    lang: 'vi' | 'en' = 'en',
  ): Promise<void> {
    const uniqueSlugs = [...new Set(breedSlugs)];
    if (uniqueSlugs.length === 0) return;

    const wikiModel = this.getWikiModel(lang);
    const breeds = await wikiModel
      .find({ slug: { $in: uniqueSlugs } })
      .select('_id')
      .lean();
    if (breeds.length === 0) return;

    await this.userCollectionModel.updateOne(
      { user_id: userId },
      { $setOnInsert: { collectedBreeds: [] } },
      { upsert: true },
    );

    await Promise.all(
      breeds.map(async (breed) => {
        const breedId = breed._id;
        const updateResult = await this.userCollectionModel.updateOne(
          { user_id: userId, 'collectedBreeds.breed_id': breedId },
          { $inc: { 'collectedBreeds.$.collection_count': 1 } },
        );

        if (updateResult.modifiedCount === 0) {
          await this.userCollectionModel.updateOne(
            { user_id: userId, 'collectedBreeds.breed_id': { $ne: breedId } },
            {
              $push: {
                collectedBreeds: {
                  breed_id: breedId,
                  first_prediction_id: predictionId,
                  collection_count: 1,
                },
              },
            },
          );
        }
      }),
    );
  }

  async addOrUpdateFromPredictionResults(
    userId: Types.ObjectId,
    predictionResults: PredictionHistoryDoc[],
    lang: 'vi' | 'en' = 'en',
  ): Promise<void> {
    if (!predictionResults || predictionResults.length === 0) return;

    await this.userCollectionModel.updateOne(
      { user_id: userId },
      { $setOnInsert: { collectedBreeds: [] } },
      { upsert: true },
    );

    const allBreedSlugs = [
      ...new Set(
        predictionResults.flatMap((p) =>
          p.predictions.map((pred) =>
            pred.class.toLowerCase().replace(/\s+/g, '-'),
          ),
        ),
      ),
    ];
    const wikiModel = this.getWikiModel(lang);
    const breedsInDb = await wikiModel
      .find({ slug: { $in: allBreedSlugs } })
      .select('_id slug')
      .lean();
    const slugToIdMap = new Map(breedsInDb.map((b) => [b.slug, b._id]));
    const operations: {
      breedId: Types.ObjectId;
      predictionId: Types.ObjectId;
    }[] = [];

    predictionResults.forEach((prediction) => {
      const predictionId = prediction._id;
      const breedSlugs = [
        ...new Set(
          prediction.predictions.map((p) =>
            p.class.toLowerCase().replace(/\s+/g, '-'),
          ),
        ),
      ];

      breedSlugs.forEach((slug) => {
        const breedId = slugToIdMap.get(slug);
        if (breedId) {
          operations.push({
            breedId: breedId as Types.ObjectId,
            predictionId: predictionId as Types.ObjectId,
          });
        }
      });
    });

    await Promise.all(
      operations.map(async (op) => {
        const { breedId, predictionId } = op;
        const updateResult = await this.userCollectionModel.updateOne(
          { user_id: userId, 'collectedBreeds.breed_id': breedId },
          { $inc: { 'collectedBreeds.$.collection_count': 1 } },
        );

        if (updateResult.modifiedCount === 0) {
          await this.userCollectionModel.updateOne(
            { user_id: userId, 'collectedBreeds.breed_id': { $ne: breedId } },
            {
              $push: {
                collectedBreeds: {
                  breed_id: breedId,
                  first_prediction_id: predictionId,
                  collection_count: 1,
                },
              },
            },
          );
        }
      }),
    );
  }

  async getUserCollection(
    userId: Types.ObjectId,
    lang: 'vi' | 'en' = 'en',
  ): Promise<CollectedBreed[]> {
    const wikiModel = this.getWikiModel(lang);
    const userCollection = await this.userCollectionModel
      .findOne({ user_id: userId, isDeleted: { $ne: true } })
      .populate({
        path: 'collectedBreeds.breed_id',
        model: wikiModel,
        select: 'breed slug group',
      })
      .populate({
        path: 'collectedBreeds.first_prediction_id',
        model: 'PredictionHistory',
        select: 'createdAt source',
      })
      .lean();
    return userCollection ? userCollection.collectedBreeds : [];
  }

  async getCollectionStats(userId: Types.ObjectId) {
    const userCollection = await this.userCollectionModel
      .findOne({ user_id: userId, isDeleted: { $ne: true } })
      .populate('collectedBreeds.breed_id', 'breed slug')
      .lean();
    if (!userCollection) {
      return {
        totalCollected: 0,
        totalPredictionsInCollection: 0,
        topBreeds: [],
      };
    }

    const totalCollected = userCollection.collectedBreeds.length;
    const totalPredictionsInCollection = userCollection.collectedBreeds.reduce(
      (sum, b) => sum + b.collection_count,
      0,
    );
    const topBreeds = [...userCollection.collectedBreeds]
      .sort((a, b) => b.collection_count - a.collection_count)
      .slice(0, 5)
      .map((b) => ({
        breed: (b.breed_id as any).breed,
        slug: (b.breed_id as any).slug,
        count: b.collection_count,
      }));

    return { totalCollected, totalPredictionsInCollection, topBreeds };
  }

  async getCollectionItemBySlug(
    userId: Types.ObjectId,
    breedSlug: string,
    lang: 'vi' | 'en' = 'en',
  ) {
    const wikiModel = this.getWikiModel(lang);
    const breed = await wikiModel
      .findOne({ slug: breedSlug })
      .select('_id')
      .lean();
    if (!breed) return null;

    const userCollection = await this.userCollectionModel
      .findOne({
        user_id: userId,
        isDeleted: { $ne: true },
        'collectedBreeds.breed_id': breed._id,
      })
      .populate('collectedBreeds.first_prediction_id', 'createdAt source')
      .lean();

    return userCollection
      ? userCollection.collectedBreeds.find(
          (cb) =>
            (cb.breed_id as any)?._id?.toString() === breed._id.toString(),
        )
      : null;
  }
}
