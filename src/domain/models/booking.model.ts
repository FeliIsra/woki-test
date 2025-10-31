import { BaseEntity } from './base.model';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

export interface Booking extends BaseEntity {
  restaurantId: string;
  sectorId: string;
  tableIds: string[];
  partySize: number;
  start: Date;
  end: Date;
  status: BookingStatus;
  customerName: string;
  customerContact?: string;
  notes?: string;
  approvalExpiresAt?: Date;
  idempotencyKey?: string;
  durationMinutes: number;
  source?: 'api' | 'internal';
}
