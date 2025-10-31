import { ApiProperty } from '@nestjs/swagger';

interface RestaurantSummary {
  id: string;
  name: string;
  timezone: string;
}

interface SectorSummary {
  id: string;
  name: string;
  restaurantId: string;
}

interface TableSummary {
  id: string;
  label: string;
  restaurantId: string;
  sectorId: string;
  minCapacity: number;
  maxCapacity: number;
  combinableWith: string[];
}

export class RestaurantSummaryDto implements RestaurantSummary {
  @ApiProperty({ example: 'resto-1' })
  id!: string;

  @ApiProperty({ example: 'WokiBrain Bistro' })
  name!: string;

  @ApiProperty({ example: 'UTC' })
  timezone!: string;
}

export class SectorSummaryDto implements SectorSummary {
  @ApiProperty({ example: 'sector-main' })
  id!: string;

  @ApiProperty({ example: 'Main Dining' })
  name!: string;

  @ApiProperty({ example: 'resto-1' })
  restaurantId!: string;
}

export class TableSummaryDto implements TableSummary {
  @ApiProperty({ example: 'table-1' })
  id!: string;

  @ApiProperty({ example: 'T1' })
  label!: string;

  @ApiProperty({ example: 'resto-1' })
  restaurantId!: string;

  @ApiProperty({ example: 'sector-main' })
  sectorId!: string;

  @ApiProperty({ example: 2 })
  minCapacity!: number;

  @ApiProperty({ example: 4 })
  maxCapacity!: number;

  @ApiProperty({ type: String, isArray: true, example: ['table-2'] })
  combinableWith!: string[];
}

export class CatalogSummaryDto {
  @ApiProperty({ type: RestaurantSummaryDto, isArray: true })
  restaurants!: RestaurantSummaryDto[];

  @ApiProperty({ type: SectorSummaryDto, isArray: true })
  sectors!: SectorSummaryDto[];

  @ApiProperty({ type: TableSummaryDto, isArray: true })
  tables!: TableSummaryDto[];

  static from(summary: {
    restaurants: RestaurantSummary[];
    sectors: SectorSummary[];
    tables: TableSummary[];
  }): CatalogSummaryDto {
    const dto = new CatalogSummaryDto();
    dto.restaurants = summary.restaurants;
    dto.sectors = summary.sectors;
    dto.tables = summary.tables;
    return dto;
  }
}
