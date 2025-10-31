import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class CreateTableDto {
  @ApiProperty({ example: 'table-4' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 'resto-1' })
  @IsString()
  @IsNotEmpty()
  restaurantId!: string;

  @ApiProperty({ example: 'sector-main' })
  @IsString()
  @IsNotEmpty()
  sectorId!: string;

  @ApiProperty({ example: 'T4' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity!: number;

  @ApiProperty({ example: 6, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity!: number;

  @ApiPropertyOptional({
    description: 'Optional list of table IDs that can be combined with the new table.'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  combinableWith?: string[];
}
