import { BookingStatus, WaitlistStatus } from '@/domain/models';
import { InMemoryStore } from '@/store/in-memory.store';
import {
  createBlackout,
  createBooking,
  createTable,
  createWaitlistEntry
} from '../utils/factories';

const date = new Date('2024-01-01T00:00:00.000Z');

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('indexes bookings by sector and table and returns them sorted', () => {
    const table = createTable({ id: 'table-1', sectorId: 'sector-1' });
    store.upsertTable(table);

    const later = createBooking({
      id: 'booking-later',
      tableIds: [table.id],
      start: new Date('2024-01-01T13:00:00.000Z'),
      end: new Date('2024-01-01T14:00:00.000Z'),
      status: BookingStatus.CONFIRMED
    });
    const earlier = createBooking({
      id: 'booking-earlier',
      tableIds: [table.id],
      start: new Date('2024-01-01T11:00:00.000Z'),
      end: new Date('2024-01-01T12:00:00.000Z'),
      status: BookingStatus.CONFIRMED
    });

    store.upsertBooking(later);
    store.upsertBooking(earlier);

    const bySector = store.listBookingsBySectorDate('sector-1', date);
    const byTable = store.listBookingsByTableDate('table-1', date);

    expect(bySector.map((booking) => booking.id)).toEqual(['booking-earlier', 'booking-later']);
    expect(byTable.map((booking) => booking.id)).toEqual(['booking-earlier', 'booking-later']);

    store.removeBooking('booking-earlier');
    expect(store.listBookingsByTableDate('table-1', date)).toHaveLength(1);
  });

  it('returns blackouts scoped to sectors and tables', () => {
    store.upsertBlackout(
      createBlackout({
        id: 'blackout-sector',
        sectorId: 'sector-1',
        start: new Date('2024-01-01T10:00:00.000Z'),
        end: new Date('2024-01-01T12:00:00.000Z')
      })
    );
    store.upsertBlackout(
      createBlackout({
        id: 'blackout-table',
        tableId: 'table-1',
        start: new Date('2024-01-01T12:00:00.000Z'),
        end: new Date('2024-01-01T14:00:00.000Z')
      })
    );

    const sectorBlackouts = store.listBlackoutsBySectorDate('sector-1', date);
    const tableBlackouts = store.listBlackoutsByTableDate('table-1', date);
    const none = store.listBlackoutsByTableDate('table-2', date);

    expect(sectorBlackouts).toHaveLength(1);
    expect(tableBlackouts).toHaveLength(1);
    expect(none).toEqual([]);

    store.removeBlackout('blackout-table');
    expect(store.listBlackoutsByTableDate('table-1', date)).toHaveLength(0);
  });

  it('sorts waitlist entries by priority then requestedAt', () => {
    const first = createWaitlistEntry({
      id: 'waitlist-low-priority',
      priority: 1,
      requestedAt: new Date('2024-01-01T10:00:00.000Z')
    });
    const second = createWaitlistEntry({
      id: 'waitlist-high-priority',
      priority: 3,
      requestedAt: new Date('2024-01-01T09:00:00.000Z')
    });
    const third = createWaitlistEntry({
      id: 'waitlist-high-priority-late',
      priority: 3,
      requestedAt: new Date('2024-01-01T11:00:00.000Z'),
      status: WaitlistStatus.WAITING
    });

    store.upsertWaitlistEntry(first);
    store.upsertWaitlistEntry(second);
    store.upsertWaitlistEntry(third);

    const ordered = store.listWaitlistBySector('sector-1');
    expect(ordered.map((entry) => entry.id)).toEqual([
      'waitlist-high-priority',
      'waitlist-high-priority-late',
      'waitlist-low-priority'
    ]);

    store.removeWaitlistEntry('waitlist-high-priority');
    expect(store.listWaitlistBySector('sector-1')).toHaveLength(2);
  });

  it('clear removes all stored entities and indexes', () => {
    store.upsertWaitlistEntry(createWaitlistEntry());
    store.upsertBooking(createBooking());
    store.upsertBlackout(createBlackout());

    store.clear();
    expect(store.listBookings()).toEqual([]);
    expect(store.listAllWaitlistEntries()).toEqual([]);
    expect(store.listBlackoutsByTableDate('table-1', date)).toEqual([]);
  });
});

