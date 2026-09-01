import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryProductHistoryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
