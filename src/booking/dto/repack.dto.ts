import { IsISO8601, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RepackDto {
  @ApiProperty({ description: 'Restaurant identifier', example: 'resto-1' })
  @IsString()
  restaurantId!: string;

  @ApiProperty({ description: 'Sector identifier whose bookings should be optimized', example: 'sector-main' })
  @IsString()
  sectorId!: string;

  @ApiProperty({ description: 'Date to repack bookings for', example: '2025-06-01' })
  @IsISO8601()
  date!: string;
}
