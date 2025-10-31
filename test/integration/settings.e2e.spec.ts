import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp, resetSeedData } from '../utils/app-factory';
import { InMemoryStore } from '@/store/in-memory.store';
import { SeedService } from '@/seed/seed.service';
import { IdempotencyService } from '@/store/idempotency.service';
import { CapacityStrategyRouter } from '@/domain/capacity-strategies';

describe('Settings endpoints (e2e)', () => {
  let app: INestApplication;
  let store: InMemoryStore;
  let seed: SeedService;
  let idempotency: IdempotencyService;
  let router: CapacityStrategyRouter;

  beforeAll(async () => {
    const context = await createTestingApp();
    app = context.app;
    store = context.store;
    seed = context.seed;
    idempotency = app.get(IdempotencyService);
    router = app.get(CapacityStrategyRouter);
  });

  beforeEach(() => {
    resetSeedData(store, seed);
    idempotency.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('resets the in-memory store and reseeds demo data', async () => {
    const server = app.getHttpServer();

    // create state: booking, idempotency key
    await request(server).post('/woki/bookings').send({
      restaurantId: 'resto-1',
      sectorId: 'sector-main',
      partySize: 2,
      start: '2025-06-01T18:00:00.000Z',
      customerName: 'Settings Guest'
    });
    idempotency.set('settings-e2e-key', { id: 'any' });

    expect(store.listBookings().length).toBeGreaterThan(0);
    expect(idempotency.has('settings-e2e-key')).toBe(true);

    const response = await request(server).post('/woki/settings/reset').expect(200);

    expect(response.body).toMatchObject({
      message: expect.stringContaining('demo dataset'),
      seededRestaurants: 1,
      seededSectors: 1,
      seededTables: 3
    });
    expect(store.listBookings().length).toBe(0);
    expect(store.listRestaurants().length).toBe(1);
    expect(store.listTablesBySector('sector-main').length).toBe(3);
    expect(idempotency.has('settings-e2e-key')).toBe(false);
  });

  it('updates the capacity strategy through the settings API', async () => {
    const server = app.getHttpServer();

    const initial = await request(server).get('/woki/settings/strategy').expect(200);
    expect(initial.body.current.key).toBe(router.getCurrentKey());

    const update = await request(server)
      .put('/woki/settings/strategy')
      .send({ key: 'maxofmins' })
      .expect(200);

    expect(update.body.current).toMatchObject({ key: 'maxofmins' });
    expect(router.getCurrentKey()).toBe('maxofmins');

    const fallback = await request(server)
      .put('/woki/settings/strategy')
      .send({ key: 'unknown-value' })
      .expect(200);

    expect(fallback.body.current.key).toBe('simple');
    expect(router.getCurrentKey()).toBe('simple');
  });

  it('exposes the current catalog of restaurants, sectors, and tables', async () => {
    const server = app.getHttpServer();
    const response = await request(server).get('/woki/settings/catalog').expect(200);

    expect(response.body.restaurants).toHaveLength(1);
    expect(response.body.sectors).toHaveLength(1);
    expect(response.body.tables.length).toBeGreaterThan(0);
    expect(response.body.restaurants[0]).toMatchObject({ id: 'resto-1' });
  });

  it('creates a restaurant with default sector and service window', async () => {
    const server = app.getHttpServer();

    const payload = {
      id: 'resto-2',
      name: 'New Venue',
      timezone: 'America/Buenos_Aires',
      sectors: [
        { id: 'resto-2-sector-main', name: 'Main Dining' },
        { id: 'resto-2-sector-terrace', name: 'Terrace' }
      ],
      serviceWindows: [
        { day: 0, windows: [{ startTime: '09:00', endTime: '21:00' }] },
        { day: 5, windows: [{ startTime: '09:00', endTime: '01:00' }] }
      ]
    };

    const response = await request(server)
      .post('/woki/settings/restaurants')
      .send(payload)
      .expect(201);

    expect(response.body.restaurants.some((r: { id: string }) => r.id === payload.id)).toBe(true);
    const mainSector = store.getSector('resto-2-sector-main');
    const terrace = store.getSector('resto-2-sector-terrace');
    expect(mainSector).toBeDefined();
    expect(terrace).toBeDefined();

    const restaurant = store.getRestaurant(payload.id);
    expect(restaurant?.serviceWindows[0][0]).toMatchObject({
      startTime: '09:00',
      endTime: '21:00'
    });
    expect(restaurant?.serviceWindows[5][0]).toMatchObject({
      startTime: '09:00',
      endTime: '01:00'
    });

    // duplicate should conflict
    await request(server)
      .post('/woki/settings/restaurants')
      .send(payload)
      .expect(409);
  });

  it('creates a table and syncs combinable references', async () => {
    const server = app.getHttpServer();

    const response = await request(server)
      .post('/woki/settings/tables')
      .send({
        id: 'table-x',
        restaurantId: 'resto-1',
        sectorId: 'sector-main',
        label: 'TX',
        minCapacity: 2,
        maxCapacity: 4,
        combinableWith: ['table-1']
      })
      .expect(201);

    expect(response.body.tables.some((t: { id: string }) => t.id === 'table-x')).toBe(true);
    const table = store.getTable('table-x');
    expect(table?.combinableWith).toContain('table-1');
    const peer = store.getTable('table-1');
    expect(peer?.combinableWith).toContain('table-x');

    // invalid sector should fail
    await request(server)
      .post('/woki/settings/tables')
      .send({
        id: 'table-invalid',
        restaurantId: 'resto-1',
        sectorId: 'unknown',
        label: 'TI',
        minCapacity: 2,
        maxCapacity: 4
      })
      .expect(400);
  });
});
