import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserRole } from '../../common/roles';
import { ProductCategoriesService } from './application/product-categories.service';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from './dto/product-category.dto';

@Controller('api/product-categories')
export class ProductCategoriesController {
  constructor(private readonly categoriesService: ProductCategoriesService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.categoriesService.list(includeInactive === 'true');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Post()
  create(@Body() dto: CreateProductCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.categoriesService.deactivate(id);
  }
}
