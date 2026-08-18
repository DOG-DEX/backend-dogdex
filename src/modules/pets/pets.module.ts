import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PetController } from './controllers/pet.controller';
import { PetService } from './services/pet.service';
import { petSchema } from './schemas/pet.schema';
import { healthRecordSchema } from './schemas/health_record.schema';
import { UserModel } from '../users/schemas/user.model';
import { PlanModel } from '../payment/schemas/plan.model';
import { CommunityPost } from '../community/schemas/community_post.model';
import { MailModule } from '../../shared/mail/mail.module';
import { CloudinaryModule } from '../../shared/cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Pet', schema: petSchema },
      { name: 'HealthRecord', schema: healthRecordSchema },
      { name: 'User', schema: UserModel.schema },
      { name: 'Plan', schema: PlanModel.schema },
      { name: 'CommunityPost', schema: CommunityPost.schema },
    ]),
    MailModule,
    CloudinaryModule,
  ],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetsModule {}
