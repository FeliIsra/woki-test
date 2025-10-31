import { ApiProperty } from '@nestjs/swagger';
import type { WaitlistEntry } from '@/domain/models';

export class WaitlistEntryResponseDto {
  @ApiProperty({ description: 'Identifier of the waitlist entry', example: 'wtl-123' })
  id!: string;

  @ApiProperty({ description: 'Restaurant identifier scoped to the entry', example: 'resto-1' })
  restaurantId!: string;

  @ApiProperty({ description: 'Sector identifier where the guest wants to be seated', example: 'sector-main' })
  sectorId!: string;

  @ApiProperty({ description: 'Size of the party waiting for a table', example: 4 })
  partySize!: number;

  @ApiProperty({ description: 'Current status of the waitlist entry', example: 'WAITING' })
  status!: string;

  @ApiProperty({ description: 'ISO timestamp when the entry was created', example: '2025-06-01T12:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ description: 'ISO timestamp when the entry will expire if not promoted', example: '2025-06-01T13:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ description: 'Priority assigned to the entry (higher first)', example: 4 })
  priority!: number;

  @ApiProperty({ description: 'Customer name provided when joining the waitlist', example: 'Jamie Doe' })
  customerName!: string;

  @ApiProperty({ description: 'Contact information to notify the customer', required: false, example: '+1 555 3344' })
  customerContact?: string;

  @ApiProperty({ description: 'Additional notes captured for the waitlist entry', required: false, example: 'High chair needed' })
  notes?: string;

  @ApiProperty({ description: 'Desired seating time if provided by the customer', required: false, example: '2025-06-01T12:30:00.000Z' })
  desiredTime?: string;

  static from(entry: WaitlistEntry): WaitlistEntryResponseDto {
    const dto = new WaitlistEntryResponseDto();
    dto.id = entry.id;
    dto.restaurantId = entry.restaurantId;
    dto.sectorId = entry.sectorId;
    dto.partySize = entry.partySize;
    dto.status = entry.status;
    dto.requestedAt = entry.requestedAt.toISOString();
    dto.expiresAt = entry.expiresAt.toISOString();
    dto.priority = entry.priority;
    dto.customerName = entry.customerName;
    dto.customerContact = entry.customerContact;
    dto.notes = entry.notes;
    dto.desiredTime = entry.desiredTime?.toISOString();
    return dto;
  }
}
