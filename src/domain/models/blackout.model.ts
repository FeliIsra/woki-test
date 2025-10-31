import { BaseEntity } from './base.model';

export interface Blackout extends BaseEntity {
  restaurantId: string;
  sectorId?: string;
  tableId?: string;
  start: Date;
  end: Date;
  reason: string;
  resolvedAt?: Date;
}
