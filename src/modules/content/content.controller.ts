import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserRole } from '../../common/roles';
import { imageUploadOptions, saveImage } from '../../common/upload.service';
import { ContentService } from './application/content.service';
import { CreateContentBlockDto, UpdateContentBlockDto } from './dto/content.dto';

@Controller('api/content-blocks')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.contentService.list(includeInactive === 'true');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Post()
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  async create(@Body() dto: CreateContentBlockDto, @UploadedFile() file?: Express.Multer.File) {
    return this.contentService.create(dto, await saveImage(file, 'content'));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  async update(@Param('id') id: string, @Body() dto: UpdateContentBlockDto, @UploadedFile() file?: Express.Multer.File) {
    const imageUrl = file ? await saveImage(file, 'content') : undefined;
    return this.contentService.update(id, dto, imageUrl);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.contentService.deactivate(id);
  }
}
