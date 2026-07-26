import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './services/user.service';
import { UserCollectionService } from './services/user-collection.service';
import { BffUserController } from './controllers/user.controller';
import { BffCollectionController } from './controllers/user-collection.controller';
import { UserModel } from './schemas/user.model';
import { UserCollectionModel } from './schemas/user_collection.model';
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
  controllers: [BffUserController, BffCollectionController],
  providers: [UserService, UserCollectionService],
  exports: [UserService, UserCollectionService],
})
export class UsersModule {}
