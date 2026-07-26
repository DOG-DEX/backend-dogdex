import { Controller, Get, Post, Put, Param, Body, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ModerationService } from '../services/moderation.service';

@ApiTags('Moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /** User reports a post/comment/user */
  @Post('reports')
  createReport(@Body() body: any, @Request() req: any) {
    return this.moderationService.createReport(req.user._id, body.targetType, body.targetId, body.reason);
  }

  /** Moderator views pending reports */
  @Get('reports')
  getPending(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.moderationService.getPendingReports(+page, +limit);
  }

  /** Moderator approves/rejects a report */
  @Put('reports/:id/review')
  review(@Param('id') id: string, @Body() body: { status: 'approved' | 'rejected' }, @Request() req: any) {
    return this.moderationService.review(id, req.user._id, body.status);
  }
}
