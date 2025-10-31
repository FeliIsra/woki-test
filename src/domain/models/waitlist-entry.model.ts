import { BaseEntity } from './base.model';

export enum WaitlistStatus {
  WAITING = 'WAITING',
  PROMOTED = 'PROMOTED',
  EXPIRED = 'EXPIRED'
}

export interface WaitlistEntry extends BaseEntity {
  restaurantId: string;
  sectorId: string;
  partySize: number;
  requestedAt: Date;
  expiresAt: Date;
  priority: number;
  status: WaitlistStatus;
  customerName: string;
  customerContact?: string;
  notes?: string;
  desiredTime?: Date;
}
