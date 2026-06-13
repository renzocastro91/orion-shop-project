import { IsBooleanString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProductCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProductCategoryDto extends CreateProductCategoryDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
