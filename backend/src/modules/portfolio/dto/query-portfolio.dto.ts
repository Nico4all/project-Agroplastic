import { IsOptional, IsString } from 'class-validator';

export class QueryPortfolioDto {
  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
