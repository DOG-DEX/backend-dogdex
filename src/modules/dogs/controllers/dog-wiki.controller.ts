import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DogsWikiService, QueryOptions } from '../services/dog-wiki.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Dogs Wiki')
@Controller('api/wiki/dogs')
export class DogWikiController {
  constructor(private readonly dogsWikiService: DogsWikiService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all dog breeds' })
  async getAllBreeds(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('group') group?: string,
    @Query('energy_level') energy_level?: string,
    @Query('trainability') trainability?: string,
    @Query('shedding_level') shedding_level?: string,
    @Query('suitable_for') suitable_for?: string,
    @Query('lang') lang = 'en',
    @Query('sort') sort?: string,
    @Query('ids') ids?: string,
    @Query('excludeIds') excludeIds?: string,
  ) {
    const options: QueryOptions = {
      page,
      limit,
      search,
      group,
      energy_level: energy_level ? parseInt(energy_level, 10) : undefined,
      trainability: trainability ? parseInt(trainability, 10) : undefined,
      shedding_level: shedding_level ? parseInt(shedding_level, 10) : undefined,
      suitable_for,
      lang: (lang === 'vi' || lang === 'en') ? lang : 'en',
      sort,
      ids: ids ? ids.split(',') : undefined,
      excludeIds: excludeIds ? excludeIds.split(',') : undefined,
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
