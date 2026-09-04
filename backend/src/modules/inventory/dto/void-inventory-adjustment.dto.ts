import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidInventoryAdjustmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  reason?: string;
}
