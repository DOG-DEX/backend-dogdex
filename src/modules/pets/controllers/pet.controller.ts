import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { PetService } from '../services/pet.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import {
  CreatePetDto,
  UpdatePetDto,
  SearchLostPetsQueryDto,
  ContactOwnerDto,
  HealthRecordDto,
} from '../dto/pet.dto';

@ApiTags('Pets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/pets')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pet profile' })
  async createPet(
    @CurrentUser('userId') userId: string,
    @Body() data: CreatePetDto,
  ) {
    return this.petService.createPet(data, userId);
  }

  @Get('my-pets')
  @ApiOperation({ summary: 'Get pets owned by the current user' })
  async getMyPets(@CurrentUser('userId') userId: string) {
    return this.petService.getPetsByOwner(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user pets (alias for my-pets)' })
  async getMine(@CurrentUser('userId') userId: string) {
    return this.petService.getPetsByOwner(userId);
  }

  @Public()
  @Get('search/lost')
  @ApiOperation({ summary: 'Search lost pets' })
  async searchLostPets(@Query() filters: SearchLostPetsQueryDto) {
    return this.petService.searchLostPets(filters);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Get public pet profile by ID or QR scan' })
  async getPublicPetInfo(@Param('id') id: string, @Req() req: Request) {
    return this.petService.getPublicPetInfo(id, req);
  }

  @Public()
  @Post('contact-owner')
  @ApiOperation({ summary: 'Send email alert to pet owner when scanned' })
  async contactOwner(@Body() body: ContactOwnerDto) {
    await this.petService.contactOwner(
      body.petId,
      body.finderName,
      body.finderPhone,
      body.message,
      body.location,
    );
    return { message: 'Message sent to pet owner successfully.' };
  }

  @Public()
  @Post('report-found')
  @ApiOperation({ summary: 'Report lost pet found' })
  async reportFound(
    @Body('petId') petId: string,
    @Body('locationInfo') locationInfo?: string,
    @Body('contactPhone') contactPhone?: string,
  ) {
    const success = await this.petService.reportFound(petId, locationInfo, contactPhone);
    return { success, message: success ? 'Pet marked as found' : 'Pet not found' };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get pet profile by ID' })
  async getPetById(@Param('id') id: string) {
    return this.petService.getPetById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update pet profile' })
  async updatePet(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateData: UpdatePetDto,
  ) {
    return this.petService.updatePet(id, userId, updateData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete pet profile' })
  async deletePet(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.petService.deletePet(id, userId);
    return { message: 'Pet profile deleted successfully.' };
  }

  @Post(':id/report-lost')
  @ApiOperation({ summary: 'Mark pet as lost' })
  async reportLost(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() location?: { lat?: number; lng?: number; address?: string },
  ) {
    return this.petService.reportLost(id, userId, location);
  }

  // Health Records
  @Post(':id/health-records')
  @ApiOperation({ summary: 'Add health record for pet' })
  async addHealthRecord(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() record: HealthRecordDto,
  ) {
    return this.petService.addHealthRecord(id, userId, record);
  }

  @Get(':id/health-records')
  @ApiOperation({ summary: 'Get health records for pet' })
  async getHealthRecords(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.petService.getHealthRecords(id, userId);
  }

  @Put(':id/health-records/:recordId')
  @ApiOperation({ summary: 'Update health record' })
  async updateHealthRecord(
    @CurrentUser('userId') userId: string,
    @Param('recordId') recordId: string,
    @Body() record: Partial<HealthRecordDto>,
  ) {
    return this.petService.updateHealthRecord(recordId, userId, record);
  }

  @Delete(':id/health-records/:recordId')
  @ApiOperation({ summary: 'Delete health record' })
  async deleteHealthRecord(
    @CurrentUser('userId') userId: string,
    @Param('recordId') recordId: string,
  ) {
    await this.petService.deleteHealthRecord(recordId, userId);
    return { message: 'Health record deleted successfully.' };
  }
}
