import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';

describe('Discovery endpoint (e2e)', () => {
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

  it('returns a candidate for available slots', async () => {
    const server = app.getHttpServer();
    const response = await request(server)
      .get('/woki/discover')
      .query({
        restaurantId: 'resto-1',
        sectorId: 'sector-main',
        partySize: 2,
        date: '2025-06-01'
      })
      .expect(200);

    expect(response.body.outcome).toBe('success');
    expect(response.body.candidate.tableIds.length).toBeGreaterThan(0);
  });
});
