import { BaseEntity } from './base.model';

export interface Table extends BaseEntity {
  restaurantId: string;
  sectorId: string;
  label: string;
  minCapacity: number;
  maxCapacity: number;
  combinableWith: string[]; // table ids that can be combined
}
