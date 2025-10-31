import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SettingsService } from './settings.service';
import { ResetResponseDto } from './dto/reset-response.dto';
import { StrategySummaryDto } from './dto/strategy-summary.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';
import { CatalogSummaryDto } from './dto/catalog-summary.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { CreateTableDto } from './dto/create-table.dto';

@ApiTags('Settings')
@Controller('woki/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'List current restaurants, sectors, and tables' })
  @ApiOkResponse({ type: CatalogSummaryDto })
  getCatalog(): CatalogSummaryDto {
    return CatalogSummaryDto.from(this.settingsService.getCatalog());
  }

  @Get('strategy')
  @ApiOperation({ summary: 'Get current capacity strategy', description: 'Provides the active heuristic and available options.' })
  @ApiOkResponse({ type: StrategySummaryDto })
  getStrategy(): StrategySummaryDto {
    const summary = this.settingsService.getStrategySummary();
    return StrategySummaryDto.from(summary);
  }

  @Put('strategy')
  @ApiOperation({ summary: 'Update capacity strategy', description: 'Switches the heuristic used by the gap discovery and assignment engine.' })
  @ApiOkResponse({ type: StrategySummaryDto })
  updateStrategy(@Body() body: UpdateStrategyDto): StrategySummaryDto {
    const summary = this.settingsService.updateStrategy(body.key);
    return StrategySummaryDto.from(summary);
  }

  @Post('restaurants')
  @ApiOperation({ summary: 'Create a restaurant', description: 'Registers a new restaurant and optional sectors.' })
  @ApiOkResponse({ type: CatalogSummaryDto })
  createRestaurant(@Body() body: CreateRestaurantDto): CatalogSummaryDto {
    return CatalogSummaryDto.from(this.settingsService.createRestaurant(body));
  }

  @Post('tables')
  @ApiOperation({ summary: 'Create a table', description: 'Adds a table to an existing sector.' })
  @ApiOkResponse({ type: CatalogSummaryDto })
  createTable(@Body() body: CreateTableDto): CatalogSummaryDto {
    return CatalogSummaryDto.from(this.settingsService.createTable(body));
  }

  @Post('reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset in-memory data',
    description: 'Clears bookings, waitlist, idempotency caches, and reloads the demo dataset.'
  })
  @ApiOkResponse({
    description: 'Confirmation that the in-memory data was reset.',
    type: ResetResponseDto
  })
  reset(): ResetResponseDto {
    const result = this.settingsService.resetMemory();
    return ResetResponseDto.from(result);
  }
}
