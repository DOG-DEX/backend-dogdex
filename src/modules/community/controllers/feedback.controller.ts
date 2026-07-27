import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { FeedbackService } from '../services/feedback.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit feedback/correction for prediction result' })
  async submitFeedback(
    @CurrentUser('userId') userId: string,
    @Body()
    body: {
      prediction_id: string;
      isCorrect: boolean;
      user_submitted_label?: string;
      notes?: string;
      file_path?: string;
    },
  ) {
    return this.feedbackService.submitFeedback(userId, body);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user submitted feedbacks' })
  async getMyFeedbacks(
    @CurrentUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.feedbackService.getFeedbacks(
      { username: userId },
      { page, limit },
    );
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'de')
  @Get()
  @ApiOperation({ summary: 'Get all user feedbacks (Admin/DE)' })
  async getFeedbacks(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('username') username?: string,
    @Query('submittedLabel') submittedLabel?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.feedbackService.getFeedbacks(
      { status, username, submittedLabel, startDate, endDate },
      { page, limit },
    );
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'de')
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Approve or reject feedback for AI training dataset (Admin/DE)',
  })
  async updateFeedbackStatus(
    @CurrentUser('userId') adminId: string,
    @Param('id') feedbackId: string,
    @Body('status') status: 'approved_for_training' | 'rejected',
    @Body('reason') reason?: string,
  ) {
    return this.feedbackService.updateFeedback(feedbackId, {
      status,
      admin_id: adminId,
      reason,
    });
  }
}
