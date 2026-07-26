import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductService } from '../services/product.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Catalog')
@Controller('catalog/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Public()
  @Get()
  findAll(@Query('page') page = 1, @Query('limit') limit = 20, @Query('category') category?: string) {
    return this.productService.findAll(+page, +limit, category);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }
}
