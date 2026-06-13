import { IsBooleanString, IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  extraInfo?: string;

  @IsNumberString()
  price: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  @IsUUID()
  categoryId?: string | null;
}

export class UpdateProductDto extends CreateProductDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}

export class RateProductDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
