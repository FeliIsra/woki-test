import fc from 'fast-check';
import { ConfigService } from '@nestjs/config';

import { GapsService } from '@/domain/gaps.service';
import { WokiBrainService } from '@/domain/wokibrain.service';
import { SimpleSumStrategy } from '@/domain/capacity-strategies/simple-sum.strategy';
import { createStoreWithDefaults } from '../utils/store-helpers';
import { BookingStatus } from '@/domain/models';

const configStub = {
  get: (key: string) => {
    if (key === 'app.repack.maxTablesPerCombo') {
      return 3;
    }
    if (key === 'app.durations') {
      return { default: 90 };
    }
    return undefined;
  }
} as unknown as ConfigService;

describe('Property-based invariants', () => {
  it('WokiBrain selection stays deterministic under random layouts', () => {
    const baseDate = new Date('2025-06-01T00:00:00Z');

    const bookingArb = fc.record({
      tableIndex: fc.integer({ min: 0, max: 2 }),
      startHour: fc.integer({ min: 10, max: 20 }),
      durationBlocks: fc.integer({ min: 1, max: 4 })
    });

    fc.assert(
      fc.property(fc.array(bookingArb, { maxLength: 12 }), fc.integer({ min: 2, max: 6 }), (layouts, partySize) => {
        const { store, seed } = createStoreWithDefaults();
        const gaps = new GapsService(store);
        const service = new WokiBrainService(store, gaps, configStub, new SimpleSumStrategy());

        const occupancy: Record<string, Array<{ start: Date; end: Date }>> = {};

        layouts.forEach(({ tableIndex, startHour, durationBlocks }, idx) => {
          const table = seed.tables[tableIndex];
          const start = new Date(baseDate);
          start.setUTCHours(startHour, 0, 0, 0);
          const end = new Date(start.getTime() + durationBlocks * 30 * 60 * 1000);

          const blocks = occupancy[table.id] ?? [];
          const overlaps = blocks.some((slot) => slot.start < end && slot.end > start);
          if (overlaps) {
            return;
          }
          blocks.push({ start, end });
          occupancy[table.id] = blocks;

          store.upsertBooking({
            id: `auto-${idx}`,
            restaurantId: seed.restaurant.id,
            sectorId: seed.sector.id,
            tableIds: [table.id],
            partySize: table.minCapacity,
            start,
            end,
            status: BookingStatus.CONFIRMED,
            customerName: 'auto',
            createdAt: start,
            updatedAt: start,
            durationMinutes: durationBlocks * 30
          });
        });

        const first = service.discover({
          restaurantId: seed.restaurant.id,
          sectorId: seed.sector.id,
          partySize,
          date: baseDate
        });
        const second = service.discover({
          restaurantId: seed.restaurant.id,
          sectorId: seed.sector.id,
          partySize,
          date: baseDate
        });
        expect(second).toEqual(first);
      }),
      { numRuns: 50 }
    );
  });
});
