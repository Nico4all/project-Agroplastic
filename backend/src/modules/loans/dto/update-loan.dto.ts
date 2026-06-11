import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLoanDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  personName?: string;

  @IsOptional()
  @IsDateString()
  loanDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
