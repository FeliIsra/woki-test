import { BookingStatus } from '@/domain/models';
import { RepackService } from '@/domain/repack.service';
import { InMemoryStore } from '@/store/in-memory.store';
import {
  createBlackout,
  createBooking,
  createTable
} from '../utils/factories';

describe('RepackService', () => {
  let store: InMemoryStore;
  let service: RepackService;

  const restaurantId = 'restaurant-1';
  const sectorId = 'sector-1';
  const date = new Date('2024-01-01T00:00:00.000Z');
  const windowStart = new Date('2024-01-01T12:00:00.000Z');
  const windowEnd = new Date('2024-01-01T14:00:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    service = new RepackService(store);

    store.upsertTable(
      createTable({
        id: 'table-large',
        restaurantId,
        sectorId,
        minCapacity: 2,
        maxCapacity: 8
      })
    );
    store.upsertTable(
      createTable({
        id: 'table-small',
        restaurantId,
        sectorId,
        minCapacity: 2,
        maxCapacity: 4
      })
    );
  });

  it('moves bookings to tighter-fitting tables when available', () => {
    const booking = createBooking({
      id: 'booking-optimise',
      restaurantId,
      sectorId,
      tableIds: ['table-large'],
      partySize: 2,
      start: windowStart,
      end: new Date('2024-01-01T13:30:00.000Z'),
      status: BookingStatus.CONFIRMED
    });
    store.upsertBooking(booking);

    const moved = service.optimize(restaurantId, sectorId, date);
    const updated = store.getBooking('booking-optimise');

    expect(moved).toBe(1);
    expect(updated?.tableIds).toEqual(['table-small']);
  });

  it('skips moves if the alternative table has a conflicting booking', () => {
    store.upsertBooking(
      createBooking({
        id: 'booking-primary',
        restaurantId,
        sectorId,
        tableIds: ['table-large'],
        partySize: 2,
        start: windowStart,
        end: windowEnd,
        status: BookingStatus.CONFIRMED
      })
    );
    store.upsertBooking(
      createBooking({
        id: 'booking-conflict',
        restaurantId,
        sectorId,
        tableIds: ['table-small'],
        partySize: 2,
        start: windowStart,
        end: windowEnd,
        status: BookingStatus.CONFIRMED
      })
    );

    const moved = service.optimize(restaurantId, sectorId, date);
    const updated = store.getBooking('booking-primary');

    expect(moved).toBe(0);
    expect(updated?.tableIds).toEqual(['table-large']);
  });

  it('does not move a booking when a blackout blocks the target table', () => {
    store.upsertBooking(
      createBooking({
        id: 'booking-blackout',
        restaurantId,
        sectorId,
        tableIds: ['table-large'],
        partySize: 2,
        start: windowStart,
        end: windowEnd,
        status: BookingStatus.CONFIRMED
      })
    );
    store.upsertBlackout(
      createBlackout({
        id: 'blackout-small',
        restaurantId,
        sectorId,
        tableId: 'table-small',
        start: windowStart,
        end: windowEnd
      })
    );

    const moved = service.optimize(restaurantId, sectorId, date);
    const updated = store.getBooking('booking-blackout');

    expect(moved).toBe(0);
    expect(updated?.tableIds).toEqual(['table-large']);
  });
});

