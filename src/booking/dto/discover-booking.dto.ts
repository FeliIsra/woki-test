import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiscoverBookingDto {
  @ApiProperty({ description: 'Restaurant identifier', example: 'resto-1' })
  @IsString()
  restaurantId!: string;

  @ApiProperty({ description: 'Sector identifier to inspect', example: 'sector-main' })
  @IsString()
  sectorId!: string;

  @ApiProperty({ description: 'Party size requesting availability', example: 4, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  partySize!: number;

  @ApiProperty({ description: 'Date to evaluate (time portion ignored)', example: '2025-06-01' })
  @IsISO8601()
  date!: string;

  @ApiPropertyOptional({ description: 'Optional override for seating duration in minutes', example: 90, minimum: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationMinutes?: number;
}
