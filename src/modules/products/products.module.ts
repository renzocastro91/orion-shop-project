import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategoriesService } from './application/product-categories.service';
import { ProductsService } from './application/products.service';
import { OrderEntity } from '../orders/domain/order.entity';
import { ProductCategoryEntity } from './domain/product-category.entity';
import { ProductEntity } from './domain/product.entity';
import { ProductRatingEntity } from './domain/product-rating.entity';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductsController } from './products.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, ProductCategoryEntity, ProductRatingEntity, OrderEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
      }),
    }),
  ],
  controllers: [ProductsController, ProductCategoriesController],
  providers: [ProductsService, ProductCategoriesService],
  exports: [ProductsService, ProductCategoriesService],
})
export class ProductsModule {}
