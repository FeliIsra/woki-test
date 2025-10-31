import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';
import { BookingStatus } from '@/domain/models';

describe('Booking endpoints (e2e)', () => {
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

  it('creates a booking and lists it for the day', async () => {
    const server = app.getHttpServer();
    const payload = {
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      partySize: 2,
      start: '2025-06-01T12:00:00.000Z',
      customerName: 'Integration Guest'
    };

    const response = await request(server).post('/woki/bookings').send(payload).expect(201);

    expect(response.body).toMatchObject({
      restaurantId: payload.restaurantId,
      sectorId: payload.sectorId,
      partySize: payload.partySize,
      status: BookingStatus.CONFIRMED
    });

    const list = await request(server)
      .get('/woki/bookings/day')
      .query({
        restaurantId: payload.restaurantId,
        sectorId: payload.sectorId,
        date: '2025-06-01'
      })
      .expect(200);

    expect(list.body.some((booking: { id: string }) => booking.id === response.body.id)).toBe(true);
  });

  it('returns conflict when the only available table is already booked', async () => {
    const server = app.getHttpServer();
    const blockStart = new Date('2025-06-01T00:00:00.000Z');
    const blockEnd = new Date('2025-06-02T00:00:00.000Z');

    store.upsertBlackout({
      id: 'booking-e2e-blk-1',
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
      id: 'booking-e2e-blk-3',
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      tableId: 'table-3',
      start: blockStart,
      end: blockEnd,
      reason: 'maintenance',
      createdAt: blockStart,
      updatedAt: blockStart
    });
    store.upsertBlackout({
      id: 'booking-e2e-blk-tail',
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      tableId: 'table-2',
      start: new Date('2025-06-01T14:30:00.000Z'),
      end: blockEnd,
      reason: 'evening event',
      createdAt: blockStart,
      updatedAt: blockStart
    });

    const payload = {
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      partySize: 4,
      start: '2025-06-01T13:00:00.000Z',
      customerName: 'First Guest'
    };

    await request(server).post('/woki/bookings').send(payload).expect(201);

    await request(server)
      .post('/woki/bookings')
      .send({ ...payload, customerName: 'Second Guest' })
      .expect(409);
  });

  it('cancels a booking and marks the record as cancelled in the store', async () => {
    const server = app.getHttpServer();
    const payload = {
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      partySize: 2,
      start: '2025-06-01T15:00:00.000Z',
      customerName: 'Cancelable Guest'
    };

    const createResponse = await request(server).post('/woki/bookings').send(payload).expect(201);

    await request(server).delete(`/woki/bookings/${createResponse.body.id}`).expect(204);

    const stored = store.getBooking(createResponse.body.id);
    expect(stored?.status).toBe(BookingStatus.CANCELLED);
  });
});
