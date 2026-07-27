import { Controller, Get, Post, Param, Query, Body, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';

import { UserCollectionService } from '../services/user-collection.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('User Collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/collections')
export class UserCollectionController {
  constructor(private readonly userCollectionService: UserCollectionService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user dog collection' })
  async getMyCollection(
    @CurrentUser('userId') userId: string,
    @Query('lang') lang: 'vi' | 'en' = 'en',
  ) {
    const userObjectId = new Types.ObjectId(userId);
    return this.userCollectionService.getUserCollection(userObjectId, lang);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get collection progress stats' })
  async getMyStats(@CurrentUser('userId') userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.userCollectionService.getCollectionStats(userObjectId);
  }

  @Get('me/:slug')
  @ApiOperation({ summary: 'Get collection item detail by breed slug' })
  async getItemBySlug(
    @CurrentUser('userId') userId: string,
    @Param('slug') slug: string,
    @Query('lang') lang: 'vi' | 'en' = 'en',
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const item = await this.userCollectionService.getCollectionItemBySlug(userObjectId, slug, lang);
    if (!item) {
      throw new NotFoundException('Chưa sưu tầm giống chó này.');
    }
    return item;
  }

  @Post('add')
  @ApiOperation({ summary: 'Add breed manually to user collection' })
  async addBreedToCollection(
    @CurrentUser('userId') userId: string,
    @Body('breedSlug') breedSlug: string,
    @Query('lang') lang: 'vi' | 'en' = 'en',
  ) {
    if (!breedSlug) {
      throw new BadRequestException('Vui lòng cung cấp breedSlug.');
    }
    const userObjectId = new Types.ObjectId(userId);
    const dummyPredictionId = new Types.ObjectId();
    await this.userCollectionService.addOrUpdateManyCollections(userObjectId, [breedSlug], dummyPredictionId, lang);
    return { message: 'Đã thêm vào bộ sưu tập thành công.' };
  }
}
