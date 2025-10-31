import { BookingStatus } from '@/domain/models';
import { GapsService } from '@/domain/gaps.service';
import { InMemoryStore } from '@/store/in-memory.store';
import { createBlackout, createBooking, createTable } from '../utils/factories';

const serviceWindow = { startTime: '10:00', endTime: '14:00' };
const serviceDate = new Date('2024-01-01T00:00:00.000Z');

describe('GapsService', () => {
  let store: InMemoryStore;
  let service: GapsService;

  beforeEach(() => {
    store = new InMemoryStore();
    service = new GapsService(store);
  });

  it('returns empty intervals when no tables are provided', () => {
    const result = service.findAvailableSlots([], serviceDate, 60, serviceWindow);
    expect(result).toEqual([]);
  });

  it('computes gaps around existing bookings and filters by duration', () => {
    store.upsertTable(createTable({ id: 'table-1' }));
    store.upsertBooking(
      createBooking({
        id: 'booking-1',
        tableIds: ['table-1'],
        start: new Date('2024-01-01T11:00:00.000Z'),
        end: new Date('2024-01-01T12:00:00.000Z'),
        status: BookingStatus.CONFIRMED
      })
    );
    store.upsertBooking(
      createBooking({
        id: 'booking-2',
        tableIds: ['table-1'],
        start: new Date('2024-01-01T12:30:00.000Z'),
        end: new Date('2024-01-01T13:00:00.000Z'),
        status: BookingStatus.PENDING
      })
    );
    store.upsertBooking(
      createBooking({
        id: 'booking-3',
        tableIds: ['table-1'],
        start: new Date('2024-01-01T13:30:00.000Z'),
        end: new Date('2024-01-01T14:30:00.000Z'),
        status: BookingStatus.CANCELLED
      })
    );

    const result = service.findAvailableSlots(['table-1'], serviceDate, 60, serviceWindow);
    expect(result).toHaveLength(2);
    expect(result[0].start.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2024-01-01T11:00:00.000Z');
    expect(result[1].start.toISOString()).toBe('2024-01-01T13:00:00.000Z');
    expect(result[1].end.toISOString()).toBe('2024-01-01T14:00:00.000Z');
  });

  it('treats blackouts as occupied intervals, including sector scoped ones', () => {
    store.upsertTable(createTable({ id: 'table-1', sectorId: 'sector-1' }));
    store.upsertBlackout(
      createBlackout({
        id: 'blackout-table',
        tableId: 'table-1',
        start: new Date('2024-01-01T10:30:00.000Z'),
        end: new Date('2024-01-01T11:30:00.000Z')
      })
    );
    store.upsertBlackout(
      createBlackout({
        id: 'blackout-sector',
        sectorId: 'sector-1',
        start: new Date('2024-01-01T12:30:00.000Z'),
        end: new Date('2024-01-01T13:00:00.000Z')
      })
    );

    const result = service.findAvailableSlots(['table-1'], serviceDate, 30, serviceWindow);
    expect(result.map((gap) => [gap.start.toISOString(), gap.end.toISOString()])).toEqual([
      ['2024-01-01T10:00:00.000Z', '2024-01-01T10:30:00.000Z'],
      ['2024-01-01T11:30:00.000Z', '2024-01-01T12:30:00.000Z'],
      ['2024-01-01T13:00:00.000Z', '2024-01-01T14:00:00.000Z']
    ]);
  });

  it('intersects gaps across multiple tables', () => {
    store.upsertTable(createTable({ id: 'table-1', sectorId: 'sector-1' }));
    store.upsertTable(createTable({ id: 'table-2', sectorId: 'sector-1' }));

    store.upsertBooking(
      createBooking({
        id: 'booking-a',
        tableIds: ['table-1'],
        start: new Date('2024-01-01T11:00:00.000Z'),
        end: new Date('2024-01-01T12:30:00.000Z')
      })
    );
    store.upsertBooking(
      createBooking({
        id: 'booking-b',
        tableIds: ['table-2'],
        start: new Date('2024-01-01T12:00:00.000Z'),
        end: new Date('2024-01-01T13:30:00.000Z')
      })
    );

    const result = service.findAvailableSlots(
      ['table-1', 'table-2'],
      serviceDate,
      30,
      serviceWindow
    );

    expect(result.map((gap) => [gap.start.toISOString(), gap.end.toISOString()])).toEqual([
      ['2024-01-01T10:00:00.000Z', '2024-01-01T11:00:00.000Z'],
      ['2024-01-01T13:30:00.000Z', '2024-01-01T14:00:00.000Z']
    ]);
  });
});

