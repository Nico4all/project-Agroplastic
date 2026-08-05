import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
