import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  reason?: string;
}
