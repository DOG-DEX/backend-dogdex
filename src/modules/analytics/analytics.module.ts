import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsAggregatorService } from './services/analytics-aggregator.service';
import { AchievementService } from './services/achievement.service';
import { LeaderboardService } from './services/leaderboard.service';
import { AnalyticsEventModel } from './schemas/analytics_event.model';
import { AnalyticsSummaryModel } from './schemas/analytics_summary.model';
import AchievementModel from './schemas/achievement.model';
import { UserCollectionModel } from '../users/schemas/user_collection.model';
import { UserModel } from '../users/schemas/user.model';
import {
  DogBreedWikiModel,
  DogBreedWikiViModel,
} from '../dogs/schemas/dogs_wiki.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AnalyticsEvent', schema: AnalyticsEventModel.schema },
      { name: 'AnalyticsSummary', schema: AnalyticsSummaryModel.schema },
      { name: 'UserCollection', schema: UserCollectionModel.schema },
      { name: 'Achievement', schema: AchievementModel.schema },
      { name: 'User', schema: UserModel.schema },
      { name: 'DogBreedWikiEn', schema: DogBreedWikiModel.schema },
      { name: 'DogBreedWikiVi', schema: DogBreedWikiViModel.schema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsAggregatorService,
    AchievementService,
    LeaderboardService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsAggregatorService,
    AchievementService,
    LeaderboardService,
  ],
})
export class AnalyticsModule {}
