import { BaseEntity } from './base.model';

export interface ServiceWindow {
  startTime: string; // HH:mm in restaurant timezone
  endTime: string; // HH:mm in restaurant timezone
}

export type ServiceWindowSchedule = Record<number, ServiceWindow[]>;

export interface Restaurant extends BaseEntity {
  name: string;
  timezone: string;
  serviceWindows: ServiceWindowSchedule;
}
