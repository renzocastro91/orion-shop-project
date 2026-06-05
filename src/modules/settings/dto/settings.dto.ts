import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateBackgroundDto {
  @IsString()
  @IsNotEmpty()
  backgroundUrl: string;
}

export class UpdateBrandDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;
}
