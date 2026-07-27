import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './services/user.service';
import { UserCollectionService } from './services/user-collection.service';
import { LeaderboardService } from './services/leaderboard.service';
import { AchievementService } from './services/achievement.service';

import { UserController } from './controllers/user.controller';
import { UserCollectionController } from './controllers/user-collection.controller';
import { LeaderboardController } from './controllers/leaderboard.controller';
import { AchievementController } from './controllers/achievement.controller';

import { UserModel } from './schemas/user.model';
import { UserCollectionModel } from './schemas/user_collection.model';
import { AchievementSchema } from './schemas/achievement.model';
import { PlanModel } from '../payment/schemas/plan.model';
import { OtpModel } from '../auth/schemas/otp.model';
import { MediaModel } from '../media/schemas/medias.model';
import { DirectoryModel } from '../media/schemas/directory.model';
import { PredictionHistoryModel } from '../predictions/schemas/prediction_history.model';
import { FeedbackModel } from '../community/schemas/feedback.model';
import { DogBreedWikiModel, DogBreedWikiViModel } from '../dogs/schemas/dogs_wiki.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserModel.schema },
      { name: 'UserCollection', schema: UserCollectionModel.schema },
      { name: 'Achievement', schema: AchievementSchema },
      { name: 'Plan', schema: PlanModel.schema },
      { name: 'Otp', schema: OtpModel.schema },
      { name: 'Media', schema: MediaModel.schema },
      { name: 'Directory', schema: DirectoryModel.schema },
      { name: 'PredictionHistory', schema: PredictionHistoryModel.schema },
      { name: 'Feedback', schema: FeedbackModel.schema },
      { name: 'DogBreedWikiEn', schema: DogBreedWikiModel.schema },
      { name: 'DogBreedWikiVi', schema: DogBreedWikiViModel.schema },
    ]),
  ],
  controllers: [
    UserController,
    UserCollectionController,
    LeaderboardController,
    AchievementController,
  ],
  providers: [
    UserService,
    UserCollectionService,
    LeaderboardService,
    AchievementService,
  ],
  exports: [
    UserService,
    UserCollectionService,
    LeaderboardService,
    AchievementService,
  ],
})
export class UsersModule {}
