import { IsBoolean } from 'class-validator';

export class UpdatePortfolioCausedStatusDto {
  @IsBoolean()
  isCaused: boolean;
}
