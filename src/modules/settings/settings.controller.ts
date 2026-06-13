import { Body, Controller, Get, Patch, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserRole } from '../../common/roles';
import { imageUploadOptions, saveImage } from '../../common/upload.service';
import { SettingsService } from './application/settings.service';
import { UpdateBackgroundDto, UpdateBrandDto, UpdatePointsRateDto } from './dto/settings.dto';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch('background')
  updateBackground(@Body() dto: UpdateBackgroundDto) {
    return this.settingsService.setBackground(dto.backgroundUrl);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch('background-image')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  async uploadBackground(@UploadedFile() file?: Express.Multer.File) {
    return this.settingsService.setBackground((await saveImage(file, 'backgrounds')) ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch('brand')
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions))
  async updateBrand(@Body() dto: UpdateBrandDto, @UploadedFile() file?: Express.Multer.File) {
    const logoUrl = file ? await saveImage(file, 'logos') : undefined;
    return this.settingsService.setBrand(dto.companyName, logoUrl);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Get('points-rate')
  getPointsRate() {
    return this.settingsService.getPointsRate();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch('points-rate')
  updatePointsRate(@Body() dto: UpdatePointsRateDto) {
    return this.settingsService.setPointsRate(dto.pesosPerPoint, dto.cashbackPesos);
  }
}
