import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas (canonical location)
import { PredictionHistoryModel } from './schemas/prediction_history.model';
import { AIModel } from './schemas/ai_models.model';
import { MediaModel } from '../media/schemas/medias.model';
import { DirectoryModel } from '../media/schemas/directory.model';
import { UserModel } from '../users/schemas/user.model';
import { FeedbackModel } from '../community/schemas/feedback.model';
import { AnalyticsEventModel } from '../analytics/schemas/analytics_event.model';

// Controller
import { PredictionController } from './controllers/prediction.controller';

// Services (new services/ subfolder)
import { PredictionService } from './services/prediction.service';
import { PredictionQueueService } from './services/prediction-queue.service';
import { PredictionHistoryService } from './services/prediction-history.service';
import { AIModelService } from './services/ai-model.service';

// Shared services registered globally — only register here for local model access
import { AnalyticsService } from '../analytics/services/analytics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PredictionHistory', schema: PredictionHistoryModel.schema },
      { name: 'AIModel', schema: AIModel.schema },
      { name: 'Media', schema: MediaModel.schema },
      { name: 'Directory', schema: DirectoryModel.schema },
      { name: 'User', schema: UserModel.schema },
      { name: 'Feedback', schema: FeedbackModel.schema },
      { name: 'AnalyticsEvent', schema: AnalyticsEventModel.schema },
    ]),
  ],
  controllers: [PredictionController],
  providers: [
    PredictionService,
    PredictionQueueService,
    PredictionHistoryService,
    AIModelService,
    AnalyticsService,
  ],
  exports: [PredictionService, PredictionHistoryService, AIModelService],
})
export class PredictionsModule {}
