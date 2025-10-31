import { ApiProperty } from '@nestjs/swagger';

interface ResetResponseProps {
  message: string;
  seededRestaurants: number;
  seededSectors: number;
  seededTables: number;
  timestamp: Date;
}

export class ResetResponseDto {
  @ApiProperty({ example: 'In-memory caches cleared and demo dataset restored.' })
  message!: string;

  @ApiProperty({ example: 1 })
  seededRestaurants!: number;

  @ApiProperty({ example: 1 })
  seededSectors!: number;

  @ApiProperty({ example: 3 })
  seededTables!: number;

  @ApiProperty({ example: '2025-06-01T12:00:00.000Z' })
  timestamp!: string;

  static from(props: ResetResponseProps): ResetResponseDto {
    const dto = new ResetResponseDto();
    dto.message = props.message;
    dto.seededRestaurants = props.seededRestaurants;
    dto.seededSectors = props.seededSectors;
    dto.seededTables = props.seededTables;
    dto.timestamp = props.timestamp.toISOString();
    return dto;
  }
}
