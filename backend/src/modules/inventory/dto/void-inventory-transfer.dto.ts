import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidInventoryTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  reason?: string;
}
