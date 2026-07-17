import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

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

  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  approvedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
