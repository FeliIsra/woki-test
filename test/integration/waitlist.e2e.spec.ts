import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';

describe('Waitlist auto-promotion (e2e)', () => {
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

  it('promotes waitlist entry after cancellation frees capacity', async () => {
    const server = app.getHttpServer();
    const startTime = '2025-06-01T18:00:00.000Z';

    const initial = await request(server)
      .post('/woki/bookings')
      .set('Idempotency-Key', 'initial-booking')
      .send({
        restaurantId: 'resto-1',
        sectorId: 'sector-main',
        partySize: 4,
        start: startTime,
        customerName: 'Original'
      })
      .expect(201);

    await request(server)
      .post('/woki/waitlist')
      .send({
        restaurantId: 'resto-1',
        sectorId: 'sector-main',
        partySize: 4,
        desiredTime: startTime,
        customerName: 'Waitlist Guest'
      })
      .expect(201);

    await request(server).delete(`/woki/bookings/${initial.body.id}`).expect(204);

    const listResponse = await request(server)
      .get('/woki/bookings/day')
      .query({
        restaurantId: 'resto-1',
        sectorId: 'sector-main',
        date: '2025-06-01T00:00:00.000Z',
        includeCancelled: true
      })
      .expect(200);

    const promoted = listResponse.body.find(
      (booking: any) => booking.customerName === 'Waitlist Guest'
    );
    expect(promoted).toBeDefined();
    expect(promoted.status).toBe('CONFIRMED');
  });
});
