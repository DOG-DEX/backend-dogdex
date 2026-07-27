import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AchievementDoc } from '../schemas/achievement.model';
import { UserDoc } from '../schemas/user.model';
import { UserCollectionDoc } from '../schemas/user_collection.model';
import { DogBreedWikiDoc } from '../../dogs/schemas/dogs_wiki.model';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    @InjectModel('Achievement') private achievementModel: Model<AchievementDoc>,
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('UserCollection') private userCollectionModel: Model<UserCollectionDoc>,
    @InjectModel('DogBreedWikiEn') private wikiEnModel: Model<DogBreedWikiDoc>,
    @InjectModel('DogBreedWikiVi') private wikiViModel: Model<DogBreedWikiDoc>,
  ) {}

  async getUserAchievements(userId: string, lang: 'vi' | 'en' = 'vi') {
    const user = await this.userModel.findById(userId);
    if (!user) return [];

    const userCollection = await this.userCollectionModel.findOne({ user_id: new Types.ObjectId(userId), isDeleted: { $ne: true } });
    const userCollections = userCollection ? userCollection.collectedBreeds : [];

    const wikiModel = lang === 'vi' ? this.wikiViModel : this.wikiEnModel;
    const totalBreedsInDB = await wikiModel.countDocuments({ isDeleted: { $ne: true } });
    const allAchievements = await this.achievementModel.find({ isDeleted: { $ne: true } });

    const unlockedKeys = new Set((user.achievements || []).map((ach) => ach.key));

    const collectedBreedDetails = await wikiModel
      .find({ _id: { $in: userCollections.map((uc) => uc.breed_id) } })
      .select('slug');
    const collectedBreedSlugs = new Set(collectedBreedDetails.map((b) => b.slug));
    const collectionCount = userCollections.length;

    const achievementsWithStatus = allAchievements.map((ach) => {
      const flattened = {
        key: ach.key,
        name: ach.name[lang] || ach.name.en,
        description: ach.description[lang] || ach.description.en,
        icon: ach.icon,
        condition: ach.condition,
      };

      const isAlreadyUnlocked = unlockedKeys.has(ach.key);
      if (isAlreadyUnlocked) {
        return { ...flattened, unlocked: true };
      }

      let isNewlyUnlocked = false;
      switch (ach.condition.type) {
        case 'collection_count':
          isNewlyUnlocked = collectionCount >= ach.condition.value;
          break;
        case 'rare_breed':
          isNewlyUnlocked = collectedBreedSlugs.has(ach.condition.breedSlug || '');
          break;
        case 'all_breeds':
          isNewlyUnlocked = collectionCount >= (totalBreedsInDB || ach.condition.value);
          break;
        default:
          isNewlyUnlocked = false;
      }

      return { ...flattened, unlocked: isNewlyUnlocked };
    });

    const newlyUnlocked = achievementsWithStatus.filter((ach) => ach.unlocked && !unlockedKeys.has(ach.key));
    if (newlyUnlocked.length > 0) {
      const newEntries = newlyUnlocked.map((ach) => ({ key: ach.key, unlockedAt: new Date() }));
      await this.userModel.updateOne({ _id: user._id }, { $push: { achievements: { $each: newEntries } } });
      this.logger.log(`User ${user.username} unlocked ${newlyUnlocked.length} new achievements.`);
    }

    return achievementsWithStatus;
  }
}
