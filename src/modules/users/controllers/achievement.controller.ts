import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { AchievementService } from '../services/achievement.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Achievements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user achievements and unlock status' })
  async getMyAchievements(
    @CurrentUser('userId') userId: string,
    @Query('lang') lang: 'vi' | 'en' = 'vi',
  ) {
    return this.achievementService.getUserAchievements(userId, lang);
  }
}
