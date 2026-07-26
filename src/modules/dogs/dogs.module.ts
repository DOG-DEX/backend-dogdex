import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DogService } from './services/dog.service';
import { DogsWikiService } from './services/dog-wiki.service';
import { BffDogController } from './controllers/dog.controller';
import { BffDogsWikiController } from './controllers/dog-wiki.controller';

import { DogProfile } from './schemas/dog_profile.model';
import { HealthRecord } from './schemas/health_record.model';
import { DogBreedWikiModel, DogBreedWikiViModel } from './schemas/dogs_wiki.model';
import { UserModel } from '../users/schemas/user.model';
import { PlanModel } from '../payment/schemas/plan.model';

import { CommunityPost } from '../community/schemas/community_post.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'DogProfile', schema: DogProfile.schema },
      { name: 'HealthRecord', schema: HealthRecord.schema },
      { name: 'DogBreedWikiEn', schema: DogBreedWikiModel.schema },
      { name: 'DogBreedWikiVi', schema: DogBreedWikiViModel.schema },
      { name: 'User', schema: UserModel.schema },
      { name: 'Plan', schema: PlanModel.schema },
      { name: 'CommunityPost', schema: CommunityPost.schema },
    ])
  ],
  controllers: [BffDogController, BffDogsWikiController],
  providers: [DogService, DogsWikiService],
  exports: [DogService, DogsWikiService],
})
export class DogsModule {}
