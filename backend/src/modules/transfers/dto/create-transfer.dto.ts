import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateTransferDto {
  @IsString()
  fromAccountId: string;

  @IsString()
  toAccountId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsDateString()
  transferDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
