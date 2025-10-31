import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WaitlistService } from '@/waitlist/waitlist.service';
import { InMemoryStore } from '@/store/in-memory.store';
import { BookingService } from '@/booking/booking.service';
import { WaitlistStatus } from '@/domain/models';
import { createWaitlistEntry } from '../utils/factories';

const createConfigService = (): ConfigService =>
  ({
    get: (key: string) => {
      if (key === 'app.waitlist.ttlMs') {
        return 1_000;
      }
      return undefined;
    }
  }) as unknown as ConfigService;

describe('WaitlistService', () => {
  let store: InMemoryStore;
  let waitlistService: WaitlistService;
  let bookingService: jest.Mocked<BookingService>;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2024-01-01T10:00:00.000Z') });
    store = new InMemoryStore();
    bookingService = {
      createBooking: jest.fn().mockResolvedValue({}),
      processWaitlist: jest.fn() as never
    } as unknown as jest.Mocked<BookingService>;

    waitlistService = new WaitlistService(store, createConfigService(), bookingService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enqueues waitlist entries with TTL and stores them in the catalog', () => {
    const entry = waitlistService.enqueue({
      restaurantId: 'restaurant-1',
      sectorId: 'sector-1',
      partySize: 2,
      customerName: 'Alice',
      customerContact: 'alice@example.com'
    });

    const stored = store.listWaitlistBySector('sector-1');
    expect(stored).toHaveLength(1);
    expect(entry.expiresAt.getTime()).toBe(entry.createdAt.getTime() + 1_000);
  });

  it('promotes waitlist entries when bookings can be created', async () => {
    const entry = waitlistService.enqueue({
      restaurantId: 'restaurant-1',
      sectorId: 'sector-1',
      partySize: 2,
      customerName: 'Bob',
      notes: 'Window seat'
    });

    await waitlistService.processQueue('restaurant-1', 'sector-1');

    expect(bookingService.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'restaurant-1',
        sectorId: 'sector-1',
        partySize: 2,
        customerName: 'Bob'
      }),
      undefined
    );
    expect(store.getWaitlistEntry(entry.id)).toBeUndefined();
  });

  it('keeps entries when bookings conflict and leaves them in WAITING state', async () => {
    bookingService.createBooking.mockRejectedValueOnce(new ConflictException('busy'));
    const entry = waitlistService.enqueue({
      restaurantId: 'restaurant-1',
      sectorId: 'sector-1',
      partySize: 2,
      customerName: 'Charlie'
    });

    await waitlistService.processQueue('restaurant-1', 'sector-1');

    const stored = store.getWaitlistEntry(entry.id);
    expect(stored?.status).toBe(WaitlistStatus.WAITING);
  });

  it('expires entries whose TTL has elapsed before promotion', async () => {
    const entry = createWaitlistEntry({
      id: 'waitlist-expire',
      restaurantId: 'restaurant-1',
      sectorId: 'sector-1',
      expiresAt: new Date('2024-01-01T10:00:30.000Z')
    });
    store.upsertWaitlistEntry(entry);

    jest.advanceTimersByTime(2_000);
    await waitlistService.processQueue('restaurant-1', 'sector-1');

    expect(store.getWaitlistEntry('waitlist-expire')).toBeUndefined();
  });
});

