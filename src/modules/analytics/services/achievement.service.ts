import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAchievement } from '../schemas/achievement.model';
import { UserDoc } from '../../users/schemas/user.model';
import { DogBreedWikiDoc } from '../../dogs/schemas/dogs_wiki.model';

const totalBreedsCache = new Map<'vi' | 'en', number>();

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);
  private cachedAchievements: IAchievement[] | null = null;

  constructor(
    @InjectModel('Achievement') private achievementModel: Model<IAchievement>,
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('DogBreedWikiEn') private wikiEnModel: Model<DogBreedWikiDoc>,
    @InjectModel('DogBreedWikiVi') private wikiViModel: Model<DogBreedWikiDoc>,
  ) {}

  private getWikiModel(lang: 'vi' | 'en' = 'vi'): Model<DogBreedWikiDoc> {
    return lang === 'vi' ? this.wikiViModel : this.wikiEnModel;
  }

  async getAllAchievementDefinitions(): Promise<IAchievement[]> {
    if (!this.cachedAchievements) {
      this.cachedAchievements = await this.achievementModel.find({
        isDeleted: { $ne: true },
      });
    }
    return this.cachedAchievements;
  }

  async processUserAchievements(
    user: UserDoc,
    userCollections: any[],
    lang: 'vi' | 'en' = 'vi',
  ) {
    const wikiModel = this.getWikiModel(lang);
    const allAchievementDefinitions = await this.getAllAchievementDefinitions();
    const unlockedKeys = new Set(
      (user.achievements || []).map((ach) => ach.key),
    );

    if (!totalBreedsCache.has(lang)) {
      const count = await wikiModel.countDocuments({
        isDeleted: { $ne: true },
      });
      totalBreedsCache.set(lang, count);
    }
    const totalBreedsInDB = totalBreedsCache.get(lang)!;

    const collectedBreedDetails = await wikiModel
      .find({
        _id: { $in: userCollections.map((uc) => uc.breed_id) },
      })
      .select('slug');
    const collectedBreedSlugs = new Set(
      collectedBreedDetails.map((b) => b.slug),
    );

    const collectionCount = userCollections.length;

    const achievementsWithStatus = allAchievementDefinitions.map((ach) => {
      const achObj = (ach as any).toObject ? (ach as any).toObject() : ach;
      const flattenedAch = {
        ...achObj,
        name: ach.name[lang] || ach.name.en,
        description: ach.description[lang] || ach.description.en,
      };

      const isAlreadyUnlocked = unlockedKeys.has(ach.key);
      if (isAlreadyUnlocked) {
        return { ...flattenedAch, unlocked: true };
      }

      const isNewlyUnlocked = this.isAchievementConditionMet(
        ach,
        collectionCount,
        collectedBreedSlugs,
        totalBreedsInDB,
      );
      return { ...flattenedAch, unlocked: isNewlyUnlocked };
    });

    const newlyUnlocked = achievementsWithStatus.filter(
      (ach) => ach.unlocked && !unlockedKeys.has(ach.key),
    );

    if (newlyUnlocked.length > 0) {
      const newAchievementsToEmbed = newlyUnlocked.map((ach) => ({
        key: ach.key,
        unlockedAt: new Date(),
      }));

      await this.userModel.updateOne(
        { _id: user._id },
        { $push: { achievements: { $each: newAchievementsToEmbed } } },
      );
      this.logger.log(
        `User ${user.username} unlocked ${newlyUnlocked.length} new achievements.`,
      );
    }

    return achievementsWithStatus;
  }

  isAchievementConditionMet(
    achievement: IAchievement,
    collectionCount: number,
    collectedSlugs: Set<string>,
    totalBreeds: number | null,
  ): boolean {
    switch (achievement.condition.type) {
      case 'collection_count':
        return collectionCount >= achievement.condition.value;
      case 'rare_breed':
        return collectedSlugs.has(achievement.condition.breedSlug || '');
      case 'all_breeds':
        return collectionCount >= (totalBreeds || achievement.condition.value);
      case 'custom':
        return false;
      default:
        return false;
    }
  }
}
