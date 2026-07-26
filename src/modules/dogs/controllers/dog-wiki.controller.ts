import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DogsWikiService, QueryOptions } from '../services/dog-wiki.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Dogs Wiki')
@Controller('api/wiki/dogs')
export class BffDogsWikiController {
  constructor(private readonly dogsWikiService: DogsWikiService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all dog breeds' })
  async getAllBreeds(@Query() query: any) {
    const options: QueryOptions = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 20,
      search: query.search,
      group: query.group,
      energy_level: query.energy_level ? parseInt(query.energy_level) : undefined,
      trainability: query.trainability ? parseInt(query.trainability) : undefined,
      shedding_level: query.shedding_level ? parseInt(query.shedding_level) : undefined,
      suitable_for: query.suitable_for,
      lang: query.lang as 'vi' | 'en' || 'en',
      sort: query.sort,
      ids: query.ids ? query.ids.split(',') : undefined,
      excludeIds: query.excludeIds ? query.excludeIds.split(',') : undefined,
    };
    return this.dogsWikiService.getAllBreeds(options);
  }

  @Public()
  @Get('count')
  @ApiOperation({ summary: 'Get total breeds count' })
  async getTotalBreedsCount(@Query('lang') lang: string) {
    const count = await this.dogsWikiService.getTotalBreedsCount(lang as 'vi' | 'en' || 'en');
    return { total: count };
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get dog breed by slug' })
  async getBreedBySlug(@Param('slug') slug: string, @Query('lang') lang: string) {
    return this.dogsWikiService.getBreedBySlug(slug, lang as 'vi' | 'en' || 'en');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'de')
  @Post()
  @ApiOperation({ summary: 'Create dog breed (Admin/DE)' })
  async createBreed(@Body() data: any, @Query('lang') lang: string) {
    return this.dogsWikiService.createBreed(data, lang as 'vi' | 'en' || 'en');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'de')
  @Put(':slug')
  @ApiOperation({ summary: 'Update dog breed (Admin/DE)' })
  async updateBreed(@Param('slug') slug: string, @Body() data: any, @Query('lang') lang: string) {
    return this.dogsWikiService.updateBreed(slug, data, lang as 'vi' | 'en' || 'en');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'de')
  @Delete(':slug')
  @ApiOperation({ summary: 'Delete dog breed (Admin/DE)' })
  async deleteBreed(@Param('slug') slug: string, @Query('lang') lang: string) {
    return this.dogsWikiService.softDeleteBreed(slug, lang as 'vi' | 'en' || 'en');
  }
}
