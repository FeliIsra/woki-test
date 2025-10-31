import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';

describe('Booking concurrency (e2e)', () => {
  let app: INestApplication;
  let store: InMemoryStore;
  let seed: SeedService;

  beforeAll(async () => {
    const context = await createTestingApp();
    app = context.app;
    store = context.store;
    seed = context.seed;
  });

  beforeEach(() => {
    resetSeedData(store, seed);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serialises conflicting requests on the same table', async () => {
    const server = app.getHttpServer();
    const blockStart = new Date('2025-06-01T00:00:00.000Z');
    const blockEnd = new Date('2025-06-02T00:00:00.000Z');
    store.upsertBlackout({
      id: 'blk-table-1',
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      tableId: 'table-1',
      start: blockStart,
      end: blockEnd,
      reason: 'maintenance',
      createdAt: blockStart,
      updatedAt: blockStart
    });
    store.upsertBlackout({
      id: 'blk-table-3',
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      tableId: 'table-3',
      start: blockStart,
      end: blockEnd,
      reason: 'maintenance',
      createdAt: blockStart,
      updatedAt: blockStart
    });

    const payload = {
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      partySize: 4,
      start: '2025-06-01T12:00:00.000Z',
      customerName: 'Concurrent'
    };

    const [first, second] = await Promise.all([
      request(server).post('/woki/bookings').set('Idempotency-Key', 'lock-1').send(payload),
      request(server).post('/woki/bookings').set('Idempotency-Key', 'lock-2').send(payload)
    ]);

    const successCount = [first.status, second.status].filter((status) => status === 201).length;
    expect(successCount).toBeGreaterThanOrEqual(1);

    const tableBookings = store
      .listBookingsByTableDate('table-2', new Date(payload.start))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 1; i < tableBookings.length; i += 1) {
      expect(tableBookings[i].start.getTime()).toBeGreaterThanOrEqual(tableBookings[i - 1].end.getTime());
    }
  });
});
