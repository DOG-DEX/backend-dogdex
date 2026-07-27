import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostController } from './controllers/post.controller';
import { FeedbackController } from './controllers/feedback.controller';
import { PostService } from './services/post.service';
import { MatchingService } from './services/matching.service';
import { FeedbackService } from './services/feedback.service';
import { CommunityPost } from './schemas/community_post.model';
import { FeedbackModel } from './schemas/feedback.model';
import { DogProfile } from '../dogs/schemas/dog_profile.model';
import { PredictionsModule } from '../predictions/predictions.module';
import { PredictionHistoryModel } from '../predictions/schemas/prediction_history.model';
import { UserModel } from '../users/schemas/user.model';
import { MediaModel } from '../media/schemas/medias.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CommunityPost', schema: CommunityPost.schema },
      { name: 'Feedback', schema: FeedbackModel.schema },
      { name: 'DogProfile', schema: DogProfile.schema },
      { name: 'PredictionHistory', schema: PredictionHistoryModel.schema },
      { name: 'User', schema: UserModel.schema },
      { name: 'Media', schema: MediaModel.schema },
    ]),
    PredictionsModule,
  ],
  controllers: [PostController, FeedbackController],
  providers: [PostService, MatchingService, FeedbackService],
  exports: [PostService, MatchingService, FeedbackService],
})
export class CommunityModule {}
