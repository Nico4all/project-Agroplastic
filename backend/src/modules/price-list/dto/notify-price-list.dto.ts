import { IsUUID } from 'class-validator';

export class NotifyPriceListDto {
  @IsUUID()
  pointOfSaleId!: string;
}
