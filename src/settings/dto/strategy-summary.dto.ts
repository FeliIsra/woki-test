import { ApiProperty } from '@nestjs/swagger';

import { StrategyOptionDto } from './strategy-option.dto';

export class StrategySummaryDto {
  @ApiProperty({ type: StrategyOptionDto })
  current!: StrategyOptionDto;

  @ApiProperty({ type: StrategyOptionDto, isArray: true })
  available!: StrategyOptionDto[];

  static from(summary: {
    current: StrategyOptionDto;
    available: StrategyOptionDto[];
  }): StrategySummaryDto {
    const dto = new StrategySummaryDto();
    dto.current = summary.current;
    dto.available = summary.available;
    return dto;
  }
}
