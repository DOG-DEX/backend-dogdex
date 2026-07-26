import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import type { Request } from 'express';

import { DogService } from '../services/dog.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Dogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/dog')
export class BffDogController {
  constructor(private readonly dogService: DogService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new dog profile' })
  async createDog(@Req() req: any, @Body() data: any) {
    return this.dogService.createDog(data, req.user.userId);
  }

  @Get('my-dogs')
  @ApiOperation({ summary: 'Get current user dogs' })
  async getMyDogs(@Req() req: any) {
    return this.dogService.getDogsByOwner(req.user.userId);
  }

  @Public()
  @Get('search/lost')
  @ApiOperation({ summary: 'Search lost dogs' })
  async searchLostDogs(@Query() filters: any) {
    return this.dogService.searchLostDogs(filters);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC QR COLLAR SCAN ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Get public dog profile when scanning QR collar (Triggers email alert if lost)' })
  async getPublicDogInfo(@Param('id') id: string, @Req() req: Request) {
    return this.dogService.getPublicDogInfo(id, req);
  }

  @Public()
  @Post('contact-owner')
  @ApiOperation({ summary: 'Send email notification to owner when someone scans QR / finds dog' })
  async contactOwner(@Body() body: { dogId: string; finderName: string; finderPhone: string; message?: string; location?: any }) {
    await this.dogService.contactOwner(body.dogId, body.finderName, body.finderPhone, body.message, body.location);
    return { message: 'Email sent to owner successfully' };
  }

  @Public()
  @Post('report-found')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Report dog found with QR code or Camera AI verification' })
  async reportFoundWithVerification(
    @Req() req: Request,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const { dogId, verificationType, contact, location } = body;
    const parsedContact = typeof contact === 'string' ? JSON.parse(contact) : contact;
    const parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;

    return this.dogService.reportFoundWithVerification(
      req,
      dogId,
      verificationType || 'qr',
      parsedContact,
      parsedLocation,
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
  async updateDog(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.dogService.updateDog(id, req.user.userId, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete dog profile' })
  async deleteDog(@Req() req: any, @Param('id') id: string) {
    await this.dogService.deleteDog(id, req.user.userId);
    return { message: 'Xóa hồ sơ thú cưng thành công' };
  }

  @Post(':id/report-lost')
  @ApiOperation({ summary: 'Report dog as lost' })
  async reportLost(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const { location, contact, additionalInfo } = body;
    return this.dogService.reportLost(id, req.user.userId, location, contact, additionalInfo);
  }

  // --- Health Records ---

  @Post(':id/health-records')
  @ApiOperation({ summary: 'Add health record' })
  async addHealthRecord(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.dogService.addHealthRecord(id, req.user.userId, data);
  }

  @Get(':id/health-records')
  @ApiOperation({ summary: 'Get health records' })
  async getHealthRecords(@Param('id') id: string) {
    return this.dogService.getHealthRecords(id);
  }

  @Put('health-records/:recordId')
  @ApiOperation({ summary: 'Update health record' })
  async updateHealthRecord(@Req() req: any, @Param('recordId') recordId: string, @Body() data: any) {
    return this.dogService.updateHealthRecord(recordId, req.user.userId, data);
  }

  @Delete('health-records/:recordId')
  @ApiOperation({ summary: 'Delete health record' })
  async deleteHealthRecord(@Req() req: any, @Param('recordId') recordId: string) {
    await this.dogService.deleteHealthRecord(recordId, req.user.userId);
    return { message: 'Xóa hồ sơ sức khỏe thành công' };
  }
}
