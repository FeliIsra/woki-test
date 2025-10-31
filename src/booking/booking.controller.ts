import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from '@nestjs/swagger';

import { BookingService } from './booking.service';
import { DiscoverBookingDto } from './dto/discover-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListDayBookingsDto } from './dto/list-day-bookings.dto';
import { RepackDto } from './dto/repack.dto';
import { ApproveBookingDto } from './dto/approve-booking.dto';
import { RateLimitGuard } from '@/common/guards/rate-limit.guard';
import { ApprovalGuard } from './guards/approval.guard';
import { BookingResponseDto } from './dto/booking-response.dto';
import { DiscoveryViewDto } from './dto/discovery-view.dto';
import { RepackResultDto } from './dto/repack-result.dto';

/**
 * Orchestrates the HTTP surface for booking workflows (discover, create, manage).
 * All routes run behind the in-memory rate limit guard to enforce API hardening.
 */
@ApiTags('Bookings')
@Controller('woki')
@UseGuards(RateLimitGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('discover')
  @ApiOperation({ summary: 'Discover the earliest available seating option' })
  @ApiOkResponse({ description: 'Discovery outcome', type: DiscoveryViewDto })
  @ApiQuery({ name: 'restaurantId', required: true, description: 'Restaurant identifier' })
  @ApiQuery({ name: 'sectorId', required: true, description: 'Sector identifier' })
  @ApiQuery({ name: 'partySize', required: true, description: 'Party size requesting a table' })
  @ApiQuery({ name: 'date', required: true, description: 'Date to evaluate (ISO string)' })
  @ApiQuery({ name: 'durationMinutes', required: false, description: 'Override seating duration (minutes)' })
  discover(@Query() query: DiscoverBookingDto): DiscoveryViewDto {
    return DiscoveryViewDto.from(this.bookingService.discoverAvailability(query));
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiCreatedResponse({ description: 'Booking successfully created', type: BookingResponseDto })
  @ApiConflictResponse({ description: 'No capacity available for the requested slot' })
  @ApiBody({ type: CreateBookingDto })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Provide to safely retry booking requests for up to 24 hours' })
  createBooking(
    @Body() body: CreateBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<BookingResponseDto> {
    // Delegates the heavy lifting (discovery + locking + persistence) to the service layer.
    return this.bookingService
      .createBooking(body, idempotencyKey)
      .then(BookingResponseDto.from);
  }

  @Get('bookings/day')
  @ApiOperation({ summary: 'List bookings scheduled for a given day and sector' })
  @ApiOkResponse({ description: 'Collection of bookings for the day', type: BookingResponseDto, isArray: true })
  @ApiQuery({ name: 'restaurantId', required: true, description: 'Restaurant identifier' })
  @ApiQuery({ name: 'sectorId', required: true, description: 'Sector identifier' })
  @ApiQuery({ name: 'includeCancelled', required: false, description: 'Set true to include cancelled bookings' })
  listBookings(@Query() query: ListDayBookingsDto): BookingResponseDto[] {
    // Returns a normalized view for front-ends—filtered to active bookings unless explicitly requested.
    return this.bookingService.listDayBookings(query).map(BookingResponseDto.from);
  }

  @Delete('bookings/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancel an existing booking' })
  @ApiNoContentResponse({ description: 'Booking cancelled successfully' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiParam({ name: 'id', description: 'Booking identifier' })
  async cancel(@Param('id') id: string): Promise<void> {
    // Cancellation also triggers waitlist promotions through the service logic.
    await this.bookingService.cancelBooking(id);
  }

  @Post('bookings/repack')
  @ApiOperation({ summary: 'Attempt to repack confirmed bookings onto tighter tables' })
  @ApiOkResponse({ description: 'Number of bookings moved to smaller tables', type: RepackResultDto })
  @ApiBody({ type: RepackDto })
  repack(@Body() body: RepackDto): Promise<RepackResultDto> {
    // Runs the B2 optimization flow and rewraps the numeric return into a DTO-friendly envelope.
    return this.bookingService.repack(body).then((moved) => RepackResultDto.from(moved));
  }

  @Put('bookings/:id/approve')
  @UseGuards(ApprovalGuard)
  @ApiOperation({ summary: 'Approve a pending large-party booking' })
  @ApiOkResponse({ description: 'Approved booking', type: BookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiParam({ name: 'id', description: 'Booking identifier' })
  @ApiBody({ type: ApproveBookingDto })
  approve(
    @Param('id') id: string,
    @Body() body: ApproveBookingDto
  ): BookingResponseDto {
    // Explicit approval transitions pending large-party bookings to confirmed.
    return BookingResponseDto.from(this.bookingService.approveBooking(id, body));
  }
}
