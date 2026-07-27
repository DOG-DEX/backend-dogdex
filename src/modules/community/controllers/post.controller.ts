import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { PostService } from '../services/post.service';
import { MatchingService } from '../services/matching.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Posts')
@Controller('api/posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly matchingService: MatchingService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new community post (lost dog / found dog / general)' })
  async createPost(
    @Req() req: Request,
    @CurrentUser('userId') authorId: string,
    @Body() dto: any,
  ) {
    if (!dto || !dto.title || !dto.content) {
      throw new BadRequestException('Tiêu đề và nội dung không được để trống.');
    }
    return this.postService.createPost(dto, authorId, req);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get community posts with search, breed, and location filters' })
  async getPosts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: any,
    @Query('breed') breed?: string,
    @Query('color') color?: string,
    @Query('status') status?: any,
  ) {
    return this.postService.getPosts({ type, breed, color, status }, page, limit);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get post details by ID' })
  async getPostById(@Param('id') id: string) {
    return this.postService.getPostById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update post by ID' })
  async updatePost(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateData: any,
  ) {
    return this.postService.updatePost(id, userId, updateData);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete post by ID' })
  async deletePost(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.postService.deletePost(id, userId);
    return { message: 'Xóa bài viết thành công.' };
  }

  @Public()
  @Get('radar/matches')
  @ApiOperation({ summary: 'Find AI matching lost or found dog posts by location and breed' })
  async findMatches(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius', new DefaultValuePipe(10), ParseIntPipe) radius: number,
    @Query('breed') breed?: string,
  ) {
    return this.postService.getRadarPosts(lat, lng, radius, breed);
  }
}
