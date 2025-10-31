import { ApiProperty } from '@nestjs/swagger';

import { BookingStatus } from '@/domain/models';
import type { BookingResponse } from '../booking.service';

export class BookingResponseDto implements BookingResponse {
  @ApiProperty({ description: 'Unique identifier for the booking', example: 'bkg-123' })
  id!: string;

  @ApiProperty({ description: 'Identifier of the restaurant the booking belongs to', example: 'resto-1' })
  restaurantId!: string;

  @ApiProperty({ description: 'Identifier of the sector hosting the booking', example: 'sector-main' })
  sectorId!: string;

  @ApiProperty({ description: 'List of tables assigned to the booking', example: ['table-2'] })
  tableIds!: string[];

  @ApiProperty({ description: 'Number of guests in the party', example: 4, minimum: 1 })
  partySize!: number;

  @ApiProperty({ description: 'ISO timestamp when the booking starts', example: '2025-06-01T13:00:00.000Z' })
  start!: string;

  @ApiProperty({ description: 'ISO timestamp when the booking ends', example: '2025-06-01T14:30:00.000Z' })
  end!: string;

  @ApiProperty({ enum: BookingStatus, description: 'Current confirmation status of the booking' })
  status!: BookingStatus;

  @ApiProperty({ description: 'Name of the customer who placed the booking', example: 'Alex Johnson' })
  customerName!: string;

  @ApiProperty({ description: 'Contact information for the customer', example: '+1 555 0100', required: false })
  customerContact?: string;

  @ApiProperty({ description: 'Additional notes captured for the booking', required: false, example: 'Birthday celebration' })
  notes?: string;

  static from(response: BookingResponse): BookingResponseDto {
    const dto = new BookingResponseDto();
    Object.assign(dto, response);
    return dto;
  }
}
