import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaController } from './controllers/media.controller';
import { MediaService } from './services/media.service';
import { DirectoryService } from './services/directory.service';
import { MediaModel } from './schemas/medias.model';
import { DirectoryModel } from './schemas/directory.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Media', schema: MediaModel.schema },
      { name: 'Directory', schema: DirectoryModel.schema },
    ])
  ],
  controllers: [MediaController],
  providers: [MediaService, DirectoryService],
  exports: [MediaService, DirectoryService]
})
export class MediaModule {}
