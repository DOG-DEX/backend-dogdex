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
import { PredictionRateLimitGuard } from '../../../common/guards/prediction-rate-limit.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  imageUploadOptions,
  mediaUploadOptions,
} from '../../../common/config/upload.config';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Predictions')
@UseGuards(PredictionRateLimitGuard)
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
  @Post('predict/image')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Predict dog breed from image file (v2 alias)' })
  async predictImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên 1 tệp hình ảnh.');
    }
    return this.predictionService.makePrediction(userId, file, 'image', req);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('predict/video')
  @UseInterceptors(FileInterceptor('file', mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Predict dog breed from video file (v2 alias)' })
  async predictVideo(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên 1 tệp video.');
    }
    return this.predictionService.makePrediction(userId, file, 'video', req);
  }

  @Public()
  @Post('stream/save')
  @ApiOperation({ summary: 'Save live stream prediction snapshot result' })
  async saveStream(
    @Req() req: Request,
    @Body() payload: any,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.predictionService.saveStreamPrediction(userId, payload, req);
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
  @ApiOperation({ summary: 'Delete prediction history item by ID' })
  async deleteHistory(
    @CurrentUser('userId') userId: string,
    @Param('id') historyId: string,
  ) {
    return this.historyService.deleteHistoryForUser(userId, historyId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GEMINI AI BREED CHATBOT ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('chat/:breedSlug')
  @ApiOperation({ summary: 'Chat with Gemini AI about a specific dog breed' })
  async chatWithGemini(
    @Param('breedSlug') breedSlug: string,
    @Body('message') message: string,
    @Req() req: Request,
    @CurrentUser('userId') userId?: string,
  ) {
    if (!message) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống.');
    }
    const langHeader = (req.headers['accept-language'] || 'vi').split(',')[0].toLowerCase();
    const lang = langHeader === 'vi' ? 'vi' : 'en';
    return this.predictionService.chatWithGemini(breedSlug, message, lang, userId);
  }

  @Public()
  @Get('chat/:breedSlug/history')
  @ApiOperation({ summary: 'Get Gemini AI chat history for a breed' })
  async getChatHistory(
    @Param('breedSlug') breedSlug: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.predictionService.getChatHistory(breedSlug, userId);
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
