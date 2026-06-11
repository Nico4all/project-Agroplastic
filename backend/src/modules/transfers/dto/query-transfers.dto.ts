import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTransfersDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}
