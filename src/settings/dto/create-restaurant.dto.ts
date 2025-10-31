import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

class ServiceWindowDto {
  @ApiProperty({ example: '11:00' })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @IsNotEmpty()
  endTime!: string;
}

class CreateSectorDto {
  @ApiProperty({ example: 'sector-main' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 'Main Dining' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

class ServiceWindowRangeDto {
  @ApiProperty({ example: '11:00' })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @IsNotEmpty()
  endTime!: string;
}

class DayServiceWindowDto {
  @ApiProperty({ example: 1, minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @ApiProperty({ type: ServiceWindowRangeDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceWindowRangeDto)
  windows!: ServiceWindowRangeDto[];
}

export class CreateRestaurantDto {
  @ApiProperty({ example: 'resto-2' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 'WokiBrain Downtown' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Default opening window applied to all days (start/end in 24h format).'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceWindowDto)
  defaultWindow?: ServiceWindowDto;

  @ApiPropertyOptional({
    type: CreateSectorDto,
    isArray: true,
    description: 'Optional list of sectors to initialize for this restaurant.'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectorDto)
  sectors?: CreateSectorDto[];

  @ApiPropertyOptional({
    type: DayServiceWindowDto,
    isArray: true,
    description:
      'Optional per-day schedules. Day uses 0-based index (0 Sunday ... 6 Saturday). Each day can define multiple windows.'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayServiceWindowDto)
  serviceWindows?: DayServiceWindowDto[];
}
