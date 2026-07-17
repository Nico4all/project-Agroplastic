import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidIncomeDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  reason?: string;
}
