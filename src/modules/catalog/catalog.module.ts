import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductModel } from './schemas/product.schema';
import { ProductService } from './services/product.service';
import { ProductController } from './controllers/product.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Product', schema: ProductModel.schema }]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class CatalogModule {}
