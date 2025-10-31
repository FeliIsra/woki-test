import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWaitlistEntryDto {
  @ApiProperty({ description: 'Restaurant identifier', example: 'resto-1' })
  @IsString()
  restaurantId!: string;

  @ApiProperty({ description: 'Sector identifier guests want to join', example: 'sector-main' })
  @IsString()
  sectorId!: string;

  @ApiProperty({ description: 'Size of the waiting party', example: 4, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  partySize!: number;

  @ApiPropertyOptional({ description: 'Preferred seating time supplied by the guest', example: '2025-06-01T12:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  desiredTime?: string;

  @ApiProperty({ description: 'Customer name for the waitlist entry', example: 'Jamie Doe', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  customerName!: string;

  @ApiPropertyOptional({ description: 'Contact details to notify the customer', example: '+1 555 3344', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerContact?: string;

  @ApiPropertyOptional({ description: 'Additional notes provided by the guest', example: 'Needs wheelchair access', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Manual priority override (defaults to party size)', example: 5, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(100)
  priority?: number;
}
