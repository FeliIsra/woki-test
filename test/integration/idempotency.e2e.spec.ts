import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';

describe('Idempotency (e2e)', () => {
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

  it('returns identical booking for repeat idempotent requests', async () => {
    const server = app.getHttpServer();
    const payload = {
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      partySize: 2,
      start: '2025-06-01T14:00:00.000Z',
      customerName: 'Idempotent Guest'
    };

    const first = await request(server)
      .post('/woki/bookings')
      .set('Idempotency-Key', 'idem-1')
      .send(payload)
      .expect(201);

    const second = await request(server)
      .post('/woki/bookings')
      .set('Idempotency-Key', 'idem-1')
      .send(payload)
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.start).toBe(first.body.start);
  });
});
