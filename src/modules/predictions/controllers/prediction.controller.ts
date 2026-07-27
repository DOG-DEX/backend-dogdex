import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { PredictionService } from '../services/prediction.service';
import { PredictionHistoryService } from '../services/prediction-history.service';
import { AIModelService } from '../services/ai-model.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  imageUploadOptions,
  mediaUploadOptions,
} from '../../../common/config/upload.config';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Predictions')
@Controller('api/predictions')
export class PredictionController {
  constructor(
    private readonly predictionService: PredictionService,
    private readonly historyService: PredictionHistoryService,
    private readonly aiModelService: AIModelService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('predict')
  @UseInterceptors(FileInterceptor('file', mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Predict dog breed from image or video file' })
  async predictFile(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: 'image' | 'video' = 'image',
    @CurrentUser('userId') userId?: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Vui lòng tải lên 1 tệp hình ảnh hoặc video.',
      );
    }
    return this.predictionService.makePrediction(userId, file, type, req);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('predict/ephemeral')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Instant prediction without saving to database' })
  async predictEphemeral(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên tệp ảnh.');
    }
    return this.predictionService.makeEphemeralPrediction(file, userId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('predict/batch')
  @UseInterceptors(FilesInterceptor('files', 10, mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Batch predictions for multiple files' })
  async predictBatch(
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('userId') userId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 tệp ảnh.');
    }
    return this.predictionService.makeBatchPredictions(userId, files, req);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('predict/url')
  @ApiOperation({ summary: 'Predict dog breed from image URL or base64 data' })
  async predictUrl(
    @Req() req: Request,
    @Body('url') url: string,
    @CurrentUser('userId') userId?: string,
  ) {
    if (!url) {
      throw new BadRequestException('URL hình ảnh không được để trống.');
    }
    return this.predictionService.makeUrlPrediction(userId, url, req);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('predict/stream')
  @ApiOperation({ summary: 'Save prediction from live stream capture' })
  async saveStreamPrediction(
    @Req() req: Request,
    @Body() payload: any,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.predictionService.saveStreamPrediction(userId, payload, req);
  }

  @Public()
  @Get('status/:id')
  @ApiOperation({ summary: 'Check async prediction job progress status' })
  async getStatus(@Param('id') id: string) {
    return this.predictionService.getPredictionStatus(id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PREDICTION HISTORY ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('history')
  @ApiOperation({ summary: 'Get current user prediction history' })
  async getMyHistory(
    @CurrentUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.historyService.getHistoryForUser(userId, {
      page,
      limit,
      search,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('history/:id')
  @ApiOperation({ summary: 'Get prediction history details by ID' })
  async getHistoryById(
    @CurrentUser('userId') userId: string,
    @Param('id') historyId: string,
  ) {
    return this.historyService.getHistoryByIdForUser(userId, historyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('history/:id')
  @ApiOperation({ summary: 'Soft delete prediction history item' })
  async deleteHistory(
    @CurrentUser('userId') userId: string,
    @Param('id') historyId: string,
  ) {
    await this.historyService.deleteHistoryForUser(userId, historyId);
    return { message: 'Đã xóa mục lịch sử dự đoán thành công.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AI MODELS ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  @Public()
  @Get('ai-models')
  @ApiOperation({ summary: 'Get active AI models list' })
  async getActiveAiModels(@Query('task') task = 'DOG_BREED_CLASSIFICATION') {
    const model = await this.aiModelService.findActiveModelForTask(task);
    return { model };
  }
}
