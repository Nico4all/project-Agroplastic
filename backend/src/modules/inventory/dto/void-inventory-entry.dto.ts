import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidInventoryEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  reason?: string;
}
