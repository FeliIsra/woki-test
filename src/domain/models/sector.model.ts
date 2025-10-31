import { BaseEntity } from './base.model';

export interface Sector extends BaseEntity {
  restaurantId: string;
  name: string;
  description?: string;
}
