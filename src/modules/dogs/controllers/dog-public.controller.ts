import { Controller, Get, Param, Query, Req, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';

import { DogService } from '../services/dog.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Public Dogs')
@Public()
@Controller('api/public/dogs')
export class DogPublicController {
  constructor(private readonly dogService: DogService) {}

  @Get('search/lost')
  @ApiOperation({ summary: 'Search lost dogs publicly' })
  async searchLostDogs(@Query() filters: any) {
    return this.dogService.searchLostDogs(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public profile for a dog when scanning collar QR' })
  async getPublicDogInfo(@Param('id') id: string, @Req() req: Request) {
    return this.dogService.getPublicDogInfo(id, req);
  }
}
