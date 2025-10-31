import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';

describe('Repack endpoint (e2e)', () => {
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

  it('returns number of moved bookings for the day', async () => {
    const server = app.getHttpServer();

    const response = await request(server)
      .post('/woki/bookings/repack')
      .send({
        restaurantId: 'resto-1',
        sectorId: 'sector-main',
        date: '2025-06-01'
      })
      .expect(201);

    expect(response.body).toHaveProperty('moved');
    expect(typeof response.body.moved).toBe('number');
  });
});
