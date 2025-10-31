import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListDayBookingsDto {
  @ApiProperty({ description: 'Restaurant identifier', example: 'resto-1' })
  @IsString()
  restaurantId!: string;

  @ApiProperty({ description: 'Sector identifier', example: 'sector-main' })
  @IsString()
  sectorId!: string;

  @ApiProperty({ description: 'Date to list bookings for', example: '2025-06-01' })
  @IsISO8601()
  date!: string;

  @ApiPropertyOptional({ description: 'Include cancelled bookings in the response', example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  includeCancelled?: boolean;
}
