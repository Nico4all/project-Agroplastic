import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdateTransferDto {
  @IsOptional()
  @IsString()
  fromAccountId?: string;

  @IsOptional()
  @IsString()
  toAccountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
