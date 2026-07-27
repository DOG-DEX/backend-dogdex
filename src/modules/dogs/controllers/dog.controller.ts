import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseEnumPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { DogService } from '../services/dog.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { imageUploadOptions } from '../../../common/config/upload.config';
import {
  ContactOwnerDto,
  CreateDogDto,
  CreateHealthRecordDto,
  FinderContactDto,
  LocationDto,
  ReportFoundVerificationType,
  ReportLostDto,
  SearchLostDogsQueryDto,
  UpdateDogDto,
  UpdateHealthRecordDto,
} from '../dto/dog.dto';
import { ParseJsonDtoPipe } from '../../../common/pipes/parse-json-dto.pipe';

@ApiTags('Dogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/dog')
export class DogController {
  constructor(private readonly dogService: DogService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new dog profile' })
  async createDog(
    @CurrentUser('userId') userId: string,
    @Body() data: CreateDogDto,
  ) {
    return this.dogService.createDog(data, userId);
  }

  @Get('my-dogs')
  @ApiOperation({ summary: 'Get current user dogs' })
  async getMyDogs(@CurrentUser('userId') userId: string) {
    return this.dogService.getDogsByOwner(userId);
  }

  @Public()
  @Get('search/lost')
  @ApiOperation({ summary: 'Search lost dogs' })
  async searchLostDogs(@Query() filters: SearchLostDogsQueryDto) {
    return this.dogService.searchLostDogs(filters);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC QR COLLAR SCAN ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  @Public()
  @Get('public/:id')
  @ApiOperation({
    summary:
      'Get public dog profile when scanning QR collar (Triggers email alert if lost)',
  })
  async getPublicDogInfo(@Param('id') id: string, @Req() req: Request) {
    return this.dogService.getPublicDogInfo(id, req);
  }

  @Public()
  @Post('contact-owner')
  @ApiOperation({
    summary:
      'Send email notification to owner when someone scans QR / finds dog',
  })
  async contactOwner(
    @Body()
    body: ContactOwnerDto,
  ) {
    await this.dogService.contactOwner(
      body.dogId,
      body.finderName,
      body.finderPhone,
      body.message,
      body.location,
    );
    return { message: 'Email sent to owner successfully' };
  }

  @Public()
  @Post('report-found')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Report dog found with QR code or Camera AI verification',
  })
  async reportFoundWithVerification(
    @Req() req: Request,
    @Body('dogId') dogId: string,
    @Body(
      'verificationType',
      new ParseEnumPipe(ReportFoundVerificationType, { optional: true }),
    )
    verificationType: ReportFoundVerificationType = ReportFoundVerificationType.QR,
    @Body('contact', new ParseJsonDtoPipe(FinderContactDto))
    contact: FinderContactDto,
    @Body('location', new ParseJsonDtoPipe(LocationDto))
    location: LocationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.dogService.reportFoundWithVerification(
      req,
      dogId,
      verificationType,
      contact,
      location,
      file,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a dog profile by ID' })
  async getDogById(@Param('id') id: string) {
    return this.dogService.getDogById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update dog profile' })
  async updateDog(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() data: UpdateDogDto,
  ) {
    return this.dogService.updateDog(id, userId, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete dog profile' })
  async deleteDog(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.dogService.deleteDog(id, userId);
    return { message: 'Xóa hồ sơ thú cưng thành công' };
  }

  @Post(':id/report-lost')
  @ApiOperation({ summary: 'Report dog as lost' })
  async reportLost(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() body: ReportLostDto,
  ) {
    const { location, contact, additionalInfo } = body;
    return this.dogService.reportLost(
      id,
      userId,
      location,
      contact,
      additionalInfo,
    );
  }

  // --- Health Records ---

  @Post(':id/health-records')
  @ApiOperation({ summary: 'Add health record' })
  async addHealthRecord(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() data: CreateHealthRecordDto,
  ) {
    return this.dogService.addHealthRecord(id, userId, data);
  }

  @Get(':id/health-records')
  @ApiOperation({ summary: 'Get health records' })
  async getHealthRecords(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.dogService.getHealthRecords(id, userId);
  }

  @Put('health-records/:recordId')
  @ApiOperation({ summary: 'Update health record' })
  async updateHealthRecord(
    @CurrentUser('userId') userId: string,
    @Param('recordId') recordId: string,
    @Body() data: UpdateHealthRecordDto,
  ) {
    return this.dogService.updateHealthRecord(recordId, userId, data);
  }

  @Delete('health-records/:recordId')
  @ApiOperation({ summary: 'Delete health record' })
  async deleteHealthRecord(
    @CurrentUser('userId') userId: string,
    @Param('recordId') recordId: string,
  ) {
    await this.dogService.deleteHealthRecord(recordId, userId);
    return { message: 'Xóa hồ sơ sức khỏe thành công' };
  }
}
