import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModerationReportModel } from './schemas/moderation-report.schema';
import { ModerationService } from './services/moderation.service';
import { ModerationController } from './controllers/moderation.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'ModerationReport', schema: ModerationReportModel.schema }]),
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
