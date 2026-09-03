import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  categoryId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  paidTo: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsBoolean()
  appliesRetention: boolean;

  @ValidateIf((dto: CreateExpenseDto) => dto.appliesRetention)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  retentionPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  retentionAmount?: number;

  @IsDateString()
  expenseDate: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  approvedBy: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
