import { IsBooleanString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContentBlockDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}

export class UpdateContentBlockDto extends CreateContentBlockDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
