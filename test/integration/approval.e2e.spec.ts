import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';

describe('Large group approval (e2e)', () => {
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

  it('approves a pending large-party booking', async () => {
    const server = app.getHttpServer();
    const bookingResponse = await request(server)
      .post('/woki/bookings')
      .set('Idempotency-Key', 'pending-1')
      .send({
        restaurantId: 'resto-1',
        sectorId: 'sector-main',
        partySize: 10,
        start: '2025-06-01T19:00:00.000Z',
        customerName: 'Group'
      })
      .expect(201);

    expect(bookingResponse.body.status).toBe('PENDING');

    const approval = await request(server)
      .put(`/woki/bookings/${bookingResponse.body.id}/approve`)
      .set('x-woki-approver', 'manager')
      .send({ approver: 'manager' })
      .expect(200);

    expect(approval.body.status).toBe('CONFIRMED');
    expect(approval.body.notes).toContain('Approved by manager');
  });
});
