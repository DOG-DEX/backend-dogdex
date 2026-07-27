import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { LeaderboardService } from '../services/leaderboard.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Leaderboard')
@Public()
@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dog collectors leaderboard' })
  async getLeaderboard(
    @Query('scope') scope: 'global' | 'country' | 'city' = 'global',
    @Query('value') value?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.leaderboardService.getLeaderboard(scope, value || null, limit);
  }

  @Get('locations')
  @ApiOperation({ summary: 'Get available leaderboard countries/cities list' })
  async getLocations(@Query('type') type: 'country' | 'city' = 'country') {
    return this.leaderboardService.getLocations(type);
  }
}
