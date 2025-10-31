import axios from 'axios';
import {
  API_BASE_URL,
  DEFAULT_DATE,
  DEFAULT_RESTAURANT_ID,
  DEFAULT_SECTOR_ID
} from './config';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000
});

export interface DiscoveryRequest {
  restaurantId: string;
  sectorId: string;
  partySize: number;
  date: string;
  durationMinutes?: number;
}

export interface DiscoveryResponse {
  outcome: 'success' | 'no_capacity';
  candidate?: {
    tableIds: string[];
    start: string;
    end: string;
    capacity: { min: number; max: number };
  };
}

export interface BookingPayload {
  restaurantId: string;
  sectorId: string;
  partySize: number;
  start: string;
  customerName: string;
  customerContact?: string;
  notes?: string;
}

export interface Booking {
  id: string;
  restaurantId: string;
  sectorId: string;
  tableIds: string[];
  partySize: number;
  start: string;
  end: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  customerName: string;
  customerContact?: string;
  notes?: string;
}

export interface WaitlistEntry {
  id: string;
  restaurantId: string;
  sectorId: string;
  partySize: number;
  status: 'WAITING' | 'PROMOTED' | 'EXPIRED';
  requestedAt: string;
  expiresAt: string;
  priority: number;
  customerName: string;
  customerContact?: string;
  notes?: string;
  desiredTime?: string;
}

export interface ResetResponse {
  message: string;
  seededRestaurants: number;
  seededSectors: number;
  seededTables: number;
  timestamp: string;
}

export interface StrategyOption {
  key: string;
  label: string;
  description: string;
}

export interface StrategySummary {
  current: StrategyOption;
  available: StrategyOption[];
}

export interface RestaurantSummary {
  id: string;
  name: string;
  timezone: string;
}

export interface SectorSummary {
  id: string;
  name: string;
  restaurantId: string;
}

export interface TableSummary {
  id: string;
  label: string;
  restaurantId: string;
  sectorId: string;
  minCapacity: number;
  maxCapacity: number;
  combinableWith: string[];
}

export interface CatalogSummary {
  restaurants: RestaurantSummary[];
  sectors: SectorSummary[];
  tables: TableSummary[];
}

export interface CreateRestaurantPayload {
  id: string;
  name: string;
  timezone?: string;
  defaultWindow?: { startTime: string; endTime: string };
  sectors?: Array<{ id: string; name: string }>;
}

export interface CreateTablePayload {
  id: string;
  restaurantId: string;
  sectorId: string;
  label: string;
  minCapacity: number;
  maxCapacity: number;
  combinableWith?: string[];
}

export const ApiService = {
  discover(request: DiscoveryRequest) {
    return api.get<DiscoveryResponse>('/woki/discover', { params: request });
  },

  createBooking(payload: BookingPayload, idempotencyKey?: string) {
    return api.post<Booking>('/woki/bookings', payload, {
      headers: idempotencyKey
        ? {
            'Idempotency-Key': idempotencyKey
          }
        : undefined
    });
  },

  listBookings(
    date = DEFAULT_DATE,
    restaurantId = DEFAULT_RESTAURANT_ID,
    sectorId = DEFAULT_SECTOR_ID
  ) {
    return api.get<Booking[]>(
      '/woki/bookings/day',
      {
        params: {
          restaurantId,
          sectorId,
          date
        }
      }
    );
  },

  cancelBooking(id: string) {
    return api.delete(`/woki/bookings/${id}`);
  },

  approveBooking(id: string, approver: string) {
    return api.put(`/woki/bookings/${id}/approve`, {
      approver
    });
  },

  addToWaitlist(body: {
    restaurantId: string;
    sectorId: string;
    partySize: number;
    customerName: string;
    customerContact?: string;
    desiredTime?: string;
    notes?: string;
  }) {
    return api.post<WaitlistEntry>('/woki/waitlist', body);
  },

  listWaitlist(
    restaurantId = DEFAULT_RESTAURANT_ID,
    sectorId = DEFAULT_SECTOR_ID
  ) {
    return api.get<WaitlistEntry[]>('/woki/waitlist', {
      params: {
        restaurantId,
        sectorId
      }
    });
  },

  repack(
    date = DEFAULT_DATE,
    restaurantId = DEFAULT_RESTAURANT_ID,
    sectorId = DEFAULT_SECTOR_ID
  ) {
    return api.post<{ moved: number }>('/woki/bookings/repack', {
      restaurantId,
      sectorId,
      date
    });
  },

  metrics() {
    return api.get('/metrics', { responseType: 'text' });
  },

  resetMemory() {
    return api.post<ResetResponse>('/woki/settings/reset');
  },

  fetchStrategy() {
    return api.get<StrategySummary>('/woki/settings/strategy');
  },

  updateStrategy(key: string) {
    return api.put<StrategySummary>('/woki/settings/strategy', { key });
  },

  fetchCatalog() {
    return api.get<CatalogSummary>('/woki/settings/catalog');
  },

  createRestaurant(payload: CreateRestaurantPayload) {
    return api.post<CatalogSummary>('/woki/settings/restaurants', payload);
  },

  createTable(payload: CreateTablePayload) {
    return api.post<CatalogSummary>('/woki/settings/tables', payload);
  }
};
