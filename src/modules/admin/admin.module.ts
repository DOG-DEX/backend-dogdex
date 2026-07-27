import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { UserModel } from '../users/schemas/user.model';
import { PredictionHistoryModel } from '../predictions/schemas/prediction_history.model';
import { AnalyticsEventModel } from '../analytics/schemas/analytics_event.model';
import { MediaModel } from '../media/schemas/medias.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserModel.schema },
      { name: 'PredictionHistory', schema: PredictionHistoryModel.schema },
      { name: 'AnalyticsEvent', schema: AnalyticsEventModel.schema },
      { name: 'Media', schema: MediaModel.schema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
