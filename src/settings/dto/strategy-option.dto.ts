import { ApiProperty } from '@nestjs/swagger';

export class StrategyOptionDto {
  @ApiProperty({ example: 'simple' })
  key!: string;

  @ApiProperty({ example: 'Simple Sum' })
  label!: string;

  @ApiProperty({
    example: 'Adds each table’s capacity ranges and fits the party within the combined values.'
  })
  description!: string;
}
