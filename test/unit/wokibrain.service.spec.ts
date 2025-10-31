import { ConfigService } from '@nestjs/config';

import { SimpleSumStrategy } from '@/domain/capacity-strategies';
import { WokiBrainService } from '@/domain/wokibrain.service';
import { GapsService } from '@/domain/gaps.service';
import { InMemoryStore } from '@/store/in-memory.store';
import {
  createBooking,
  createRestaurant,
  createSector,
  createTable
} from '../utils/factories';

const createConfigService = (overrides: Record<string, unknown> = {}): ConfigService =>
  ({
    get: (key: string) => {
      if (key === 'app.repack.maxTablesPerCombo') {
        return overrides['maxTablesPerCombo'] ?? 4;
      }
      if (key === 'app.durations') {
        return (
          overrides['durations'] ?? {
            default: 90,
            2: 60,
            4: 75,
            6: 120
          }
        );
      }
      return undefined;
    }
  }) as unknown as ConfigService;

describe('WokiBrainService', () => {
  let store: InMemoryStore;
  let service: WokiBrainService;

  const serviceDate = new Date('2024-01-01T10:00:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    const configService = createConfigService();
    const gapsService = new GapsService(store);
    const capacityStrategy = new SimpleSumStrategy();
    service = new WokiBrainService(store, gapsService, configService, capacityStrategy);

    store.upsertRestaurant(
      createRestaurant({
        id: 'restaurant-1',
        serviceWindows: {
          // 1 => Monday
          1: [{ startTime: '10:00', endTime: '14:00' }]
        }
      })
    );
    store.upsertSector(
      createSector({
        id: 'sector-1',
        restaurantId: 'restaurant-1'
      })
    );
  });

  it('returns no capacity when the restaurant cannot be found', () => {
    const result = service.discover({
      restaurantId: 'unknown',
      sectorId: 'sector-1',
      partySize: 4,
      date: serviceDate
    });

    expect(result).toEqual({
      outcome: 'no_capacity',
      reason: 'restaurant_not_found'
    });
  });

  it('prefers the earliest candidate and breaks ties on smallest capacity', () => {
    store.upsertTable(
      createTable({
        id: 't1',
        minCapacity: 2,
        maxCapacity: 2,
        combinableWith: ['t2']
      })
    );
    store.upsertTable(
      createTable({
        id: 't2',
        minCapacity: 2,
        maxCapacity: 4,
        combinableWith: ['t1', 't3']
      })
    );
    store.upsertTable(
      createTable({
        id: 't3',
        minCapacity: 4,
        maxCapacity: 6,
        combinableWith: ['t2']
      })
    );

    const result = service.discover({
      restaurantId: 'restaurant-1',
      sectorId: 'sector-1',
      partySize: 4,
      date: serviceDate
    });

    expect(result.outcome).toBe('success');
    expect(result.candidate?.tableIds).toEqual(['t2']);
    expect(result.candidate?.start.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    expect(result.candidate?.capacity).toEqual({ min: 2, max: 4 });
  });

  it('skips gaps that cannot satisfy notBefore + duration and picks the next one', () => {
    store.upsertTable(
      createTable({
        id: 't2',
        minCapacity: 2,
        maxCapacity: 4
      })
    );

    store.upsertBooking(
      createBooking({
        id: 'booking-1',
        tableIds: ['t2'],
        start: new Date('2024-01-01T11:00:00.000Z'),
        end: new Date('2024-01-01T12:00:00.000Z')
      })
    );

    const result = service.discover({
      restaurantId: 'restaurant-1',
      sectorId: 'sector-1',
      partySize: 2,
      date: serviceDate,
      durationMinutes: 60,
      notBefore: new Date('2024-01-01T10:30:00.000Z')
    });

    expect(result.outcome).toBe('success');
    expect(result.candidate?.start.toISOString()).toBe('2024-01-01T12:00:00.000Z');
    expect(result.candidate?.end.toISOString()).toBe('2024-01-01T13:00:00.000Z');
  });
});

