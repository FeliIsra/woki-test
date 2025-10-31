import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BookingService } from '@/booking/booking.service';
import { InMemoryStore } from '@/store/in-memory.store';
import { WokiBrainService } from '@/domain/wokibrain.service';
import { LockingService } from '@/store/locking.service';
import { IdempotencyService } from '@/store/idempotency.service';
import { MetricsService } from '@/metrics/metrics.service';
import { WaitlistService } from '@/waitlist/waitlist.service';
import { RepackService } from '@/domain/repack.service';

describe('BookingService', () => {
  let config: ConfigService;
  let idempotencyService: IdempotencyService<any>;
  let metrics: jest.Mocked<MetricsService>;
  let locking: LockingService;
  let waitlist: jest.Mocked<WaitlistService>;
  let repack: jest.Mocked<RepackService>;

  const now = new Date('2025-06-01T12:00:00Z');

  const createStore = () => {
    const store = new InMemoryStore();
    store.upsertRestaurant({
      id: 'resto',
      name: 'Restaurant',
      timezone: 'UTC',
      serviceWindows: { [now.getDay()]: [{ startTime: '10:00', endTime: '22:00' }] },
      createdAt: now,
      updatedAt: now
    });
    store.upsertSector({
      id: 'sector',
      restaurantId: 'resto',
      name: 'Main',
      createdAt: now,
      updatedAt: now
    });
    store.upsertTable({
      id: 'table-1',
      restaurantId: 'resto',
      sectorId: 'sector',
      label: 'T1',
      minCapacity: 2,
      maxCapacity: 4,
      combinableWith: [],
      createdAt: now,
      updatedAt: now
    });
    return store;
  };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'app.largeGroupThreshold') {
          return 8;
        }
        if (key === 'app.approvalTtlMs') {
          return 86_400_000;
        }
        if (key === 'app.bookings.idempotencyTtlMs') {
          return 60_000;
        }
        if (key === 'app.bookings.persistentTtlMs') {
          return 120_000;
        }
        return undefined;
      })
    } as unknown as ConfigService;

    idempotencyService = new IdempotencyService(config);
    metrics = {
      incrementBookingsCreated: jest.fn(),
      incrementBookingsCancelled: jest.fn(),
      incrementConflicts: jest.fn(),
      incrementLockContention: jest.fn(),
      observeAssignmentDuration: jest.fn(),
      serialize: jest.fn()
    } as unknown as jest.Mocked<MetricsService>;
    locking = new LockingService();
    waitlist = {
      triggerPromotion: jest.fn()
    } as unknown as jest.Mocked<WaitlistService>;
    repack = {
      optimize: jest.fn()
    } as unknown as jest.Mocked<RepackService>;
  });

  afterEach(() => {
    locking.onModuleDestroy();
  });

  it('throws conflict when discover finds no capacity', async () => {
    const store = createStore();
    const wokiBrain = {
      discover: jest.fn(() => ({ outcome: 'no_capacity' }))
    } as unknown as WokiBrainService;

    const service = new BookingService(
      store,
      wokiBrain,
      locking,
      idempotencyService,
      metrics,
      config,
      waitlist,
      repack
    );

    await expect(() =>
      service.createBooking(
        {
          restaurantId: 'resto',
          sectorId: 'sector',
          partySize: 2,
          start: now.toISOString(),
          customerName: 'Guest'
        },
        'conflict-key'
      )
    ).rejects.toThrow(ConflictException);

    expect(metrics.incrementConflicts).toHaveBeenCalled();
  });

  it('creates pending booking for large group with approval TTL', async () => {
    const store = createStore();
    const candidateStart = new Date('2025-06-01T18:00:00.000Z');
    const wokiBrain = {
      discover: jest.fn(() => ({
        outcome: 'success',
        candidate: {
          tableIds: ['table-1'],
          start: candidateStart,
          end: new Date(candidateStart.getTime() + 90 * 60 * 1000),
          capacity: { min: 2, max: 4 }
        }
      }))
    } as unknown as WokiBrainService;

    const service = new BookingService(
      store,
      wokiBrain,
      locking,
      idempotencyService,
      metrics,
      config,
      waitlist,
      repack
    );

    const response = await service.createBooking(
      {
        restaurantId: 'resto',
        sectorId: 'sector',
        partySize: 10,
        start: candidateStart.toISOString(),
        customerName: 'Group'
      },
      'pending-key'
    );

    expect(response.status).toBe('PENDING');
    expect(response.tableIds).toEqual(['table-1']);
    expect(store.listBookingsBySectorDate('sector', candidateStart)).toHaveLength(1);
  });
});
