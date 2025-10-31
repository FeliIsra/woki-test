import {
  Blackout,
  Booking,
  BookingStatus,
  Restaurant,
  Sector,
  Table,
  WaitlistEntry,
  WaitlistStatus
} from '@/domain/models';

const baseDate = (): Date => new Date('2024-01-01T10:00:00.000Z');

const withDates = <T extends { createdAt: Date; updatedAt: Date }>(
  entity: Omit<T, 'createdAt' | 'updatedAt'>
): T => {
  const timestamp = baseDate();
  return {
    ...(entity as Record<string, unknown>),
    createdAt: timestamp,
    updatedAt: timestamp
  } as T;
};

export const createRestaurant = (
  overrides: Partial<Restaurant> = {}
): Restaurant =>
  withDates<Restaurant>({
    id: 'restaurant-1',
    name: 'Test Restaurant',
    timezone: 'UTC',
    serviceWindows: {
      0: [{ startTime: '09:00', endTime: '21:00' }],
      1: [{ startTime: '09:00', endTime: '21:00' }],
      2: [{ startTime: '09:00', endTime: '21:00' }],
      3: [{ startTime: '09:00', endTime: '21:00' }],
      4: [{ startTime: '09:00', endTime: '21:00' }],
      5: [{ startTime: '09:00', endTime: '23:00' }],
      6: [{ startTime: '09:00', endTime: '23:00' }]
    },
    ...overrides
  });

export const createSector = (overrides: Partial<Sector> = {}): Sector =>
  withDates<Sector>({
    id: 'sector-1',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    name: 'Main',
    ...overrides
  });

export const createTable = (overrides: Partial<Table> = {}): Table =>
  withDates<Table>({
    id: overrides.id ?? 'table-1',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    sectorId: overrides.sectorId ?? 'sector-1',
    label: overrides.label ?? 'T1',
    minCapacity: overrides.minCapacity ?? 2,
    maxCapacity: overrides.maxCapacity ?? 4,
    combinableWith: overrides.combinableWith ?? [],
    ...overrides
  });

export const createBooking = (
  overrides: Partial<Booking> = {}
): Booking =>
  withDates<Booking>({
    id: overrides.id ?? 'booking-1',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    sectorId: overrides.sectorId ?? 'sector-1',
    tableIds: overrides.tableIds ?? ['table-1'],
    partySize: overrides.partySize ?? 2,
    start:
      overrides.start ??
      new Date('2024-01-01T12:00:00.000Z'),
    end:
      overrides.end ??
      new Date('2024-01-01T13:30:00.000Z'),
    status: overrides.status ?? BookingStatus.CONFIRMED,
    customerName: overrides.customerName ?? 'John Doe',
    customerContact: overrides.customerContact,
    notes: overrides.notes,
    approvalExpiresAt: overrides.approvalExpiresAt,
    idempotencyKey: overrides.idempotencyKey,
    durationMinutes:
      overrides.durationMinutes ??
      Math.round(
        ((overrides.end ??
          new Date('2024-01-01T13:30:00.000Z')).getTime() -
          (overrides.start ??
            new Date('2024-01-01T12:00:00.000Z')).getTime()) /
          60000
      ),
    source: overrides.source ?? 'api'
  });

export const createBlackout = (
  overrides: Partial<Blackout> = {}
): Blackout =>
  withDates<Blackout>({
    id: overrides.id ?? 'blackout-1',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    sectorId: overrides.sectorId,
    tableId: overrides.tableId,
    start:
      overrides.start ??
      new Date('2024-01-01T11:00:00.000Z'),
    end:
      overrides.end ??
      new Date('2024-01-01T12:00:00.000Z'),
    reason: overrides.reason ?? 'Maintenance',
    resolvedAt: overrides.resolvedAt
  });

export const createWaitlistEntry = (
  overrides: Partial<WaitlistEntry> = {}
): WaitlistEntry =>
  withDates<WaitlistEntry>({
    id: overrides.id ?? 'waitlist-1',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    sectorId: overrides.sectorId ?? 'sector-1',
    partySize: overrides.partySize ?? 2,
    requestedAt:
      overrides.requestedAt ??
      new Date('2024-01-01T10:00:00.000Z'),
    expiresAt:
      overrides.expiresAt ??
      new Date('2024-01-01T11:00:00.000Z'),
    priority: overrides.priority ?? 1,
    status: overrides.status ?? WaitlistStatus.WAITING,
    customerName: overrides.customerName ?? 'Alice',
    customerContact: overrides.customerContact,
    notes: overrides.notes,
    desiredTime: overrides.desiredTime
  });

