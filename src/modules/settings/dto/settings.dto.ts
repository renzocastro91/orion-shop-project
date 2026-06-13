import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

export class UpdatePointsRateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pesosPerPoint: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  cashbackPesos: number;
}
