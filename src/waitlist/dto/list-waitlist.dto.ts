import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ListWaitlistDto {
  @ApiProperty({ description: 'Restaurant identifier', example: 'resto-1' })
  @IsString()
  restaurantId!: string;

  @ApiProperty({ description: 'Sector identifier', example: 'sector-main' })
  @IsString()
  sectorId!: string;
}
