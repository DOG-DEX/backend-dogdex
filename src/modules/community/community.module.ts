import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BffPostController } from './controllers/post.controller';
import { PostService } from './services/post.service';
import { MatchingService } from './services/matching.service';
import { FeedbackService } from './services/feedback.service';
import { CommunityPost } from './schemas/community_post.model';
import { FeedbackModel } from './schemas/feedback.model';
import { DogProfile } from '../dogs/schemas/dog_profile.model';
import { PredictionsModule } from '../predictions/predictions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CommunityPost', schema: CommunityPost.schema },
      { name: 'Feedback', schema: FeedbackModel.schema },
      { name: 'DogProfile', schema: DogProfile.schema },
      { name: 'PredictionHistory', schema: require('../predictions/schemas/prediction_history.model').PredictionHistoryModel.schema },
      { name: 'User', schema: require('../users/schemas/user.model').UserModel.schema },
      { name: 'Media', schema: require('../media/schemas/medias.model').MediaModel.schema },
    ]),
    PredictionsModule
  ],
  controllers: [BffPostController],
  providers: [PostService, MatchingService, FeedbackService],
  exports: [PostService, MatchingService, FeedbackService]
})
export class CommunityModule {}
