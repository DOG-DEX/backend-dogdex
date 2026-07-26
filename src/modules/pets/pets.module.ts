import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PetModel } from './schemas/pet.schema';
import { PetService } from './services/pet.service';
import { PetController } from './controllers/pet.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Pet', schema: PetModel.schema }]),
  ],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetsModule {}
