import { Controller, Get, Post, Query, Body, BadRequestException, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeaderboardService } from '../services/leaderboard.service';
import { MailService } from '../../../shared/mail/mail.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Analytics & Leaderboard')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly mailService: MailService,
  ) {}

  @Public()
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get global, country, or city leaderboard' })
  async getLeaderboard(
    @Query('type') type = 'global',
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('value') value?: string,
  ) {
    const validTypes = ['global', 'country', 'city'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException('Invalid leaderboard scope type');
    }
    const data = await this.leaderboardService.getLeaderboard(
      type as 'global' | 'country' | 'city',
      value || null,
      limit,
    );
    return { success: true, scope: type, filterValue: value || 'Global', data };
  }

  @Public()
  @Get('leaderboard/locations')
  @ApiOperation({ summary: 'Get list of available countries/cities in leaderboard' })
  async getLocations(@Query('type') type: 'country' | 'city') {
    if (type !== 'country' && type !== 'city') {
      throw new BadRequestException('Type must be country or city');
    }
    const data = await this.leaderboardService.getLocations(type);
    return { success: true, type, data };
  }

  @Public()
  @Post('contact')
  @ApiOperation({ summary: 'Handle contact form submission' })
  async handleContactForm(@Body() body: { email: string; message: string }) {
    if (!body.email || !body.message) {
      throw new BadRequestException('Email and message are required');
    }
    await this.mailService.sendContactFormEmail({ fromEmail: body.email, message: body.message });
    return { message: 'Thank you! Your message has been sent.' };
  }
}
