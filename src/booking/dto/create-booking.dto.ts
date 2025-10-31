import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MaxLength
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Restaurant identifier', example: 'resto-1' })
  @IsString()
  restaurantId!: string;

  @ApiProperty({ description: 'Sector identifier where the booking should take place', example: 'sector-main' })
  @IsString()
  sectorId!: string;

  @ApiProperty({ description: 'Number of guests for the booking', minimum: 1, maximum: 100, example: 4 })
  @IsInt()
  @Min(1)
  @Max(100)
  partySize!: number;

  @ApiProperty({ description: 'Desired start time in ISO format', example: '2025-06-01T12:00:00.000Z' })
  @IsISO8601()
  start!: string;

  @ApiPropertyOptional({ description: 'Explicit duration in minutes (otherwise auto-derived)', example: 90, minimum: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationMinutes?: number;

  @ApiProperty({ description: 'Name of the guest making the booking', example: 'Alex Johnson', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  customerName!: string;

  @ApiPropertyOptional({ description: 'Contact details to reach the guest', example: '+1 555 0100', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerContact?: string;

  @ApiPropertyOptional({ description: 'Additional information supplied by the guest', example: 'Anniversary dinner', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
