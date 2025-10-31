import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { WaitlistService } from './waitlist.service';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';
import { ListWaitlistDto } from './dto/list-waitlist.dto';
import { RateLimitGuard } from '@/common/guards/rate-limit.guard';
import { WaitlistEntry } from '@/domain/models';
import { WaitlistEntryResponseDto } from './dto/waitlist-entry-response.dto';

@ApiTags('Waitlist')
@Controller('woki/waitlist')
@UseGuards(RateLimitGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @ApiOperation({ summary: 'Add a party to the waitlist' })
  @ApiCreatedResponse({ description: 'Waitlist entry stored', type: WaitlistEntryResponseDto })
  @ApiBody({ type: CreateWaitlistEntryDto })
  enqueue(@Body() body: CreateWaitlistEntryDto): WaitlistEntryResponseDto {
    return this.toResponse(this.waitlistService.enqueue(body));
  }

  @Get()
  @ApiOperation({ summary: 'List waitlist entries for a sector' })
  @ApiOkResponse({ description: 'Waitlist entries', type: WaitlistEntryResponseDto, isArray: true })
  @ApiQuery({ name: 'restaurantId', required: true, description: 'Restaurant identifier' })
  @ApiQuery({ name: 'sectorId', required: true, description: 'Sector identifier' })
  list(@Query() query: ListWaitlistDto): WaitlistEntryResponseDto[] {
    return this.waitlistService.list(query).map((entry) => this.toResponse(entry));
  }

  private toResponse(entry: WaitlistEntry): WaitlistEntryResponseDto {
    return WaitlistEntryResponseDto.from(entry);
  }
}
