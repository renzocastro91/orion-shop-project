import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserRole } from '../../common/roles';
import { imageUploadOptions, saveImage } from '../../common/upload.service';
import { ProductsService } from './application/products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.productsService.list(includeInactive === 'true');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Post()
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  async create(@Body() dto: CreateProductDto, @UploadedFile() file?: Express.Multer.File) {
    return this.productsService.create(dto, await saveImage(file, 'products'));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @UploadedFile() file?: Express.Multer.File) {
    const imageUrl = file ? await saveImage(file, 'products') : undefined;
    return this.productsService.update(id, dto, imageUrl);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }
}
