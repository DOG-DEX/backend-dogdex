import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DogsWikiService } from './services/dog-wiki.service';
import { DogWikiController } from './controllers/dog-wiki.controller';
import {
  DogBreedWikiModel,
  DogBreedWikiViModel,
} from './schemas/dogs_wiki.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'DogBreedWikiEn', schema: DogBreedWikiModel.schema },
      { name: 'DogBreedWikiVi', schema: DogBreedWikiViModel.schema },
    ]),
  ],
  controllers: [DogWikiController],
  providers: [DogsWikiService],
  exports: [DogsWikiService],
})
export class DogsModule {}
