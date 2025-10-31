import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CapacityStrategy, CAPACITY_STRATEGY_TOKEN } from './capacity-strategies';
import {
  Booking,
  BookingStatus,
  Restaurant,
  Table
} from './models';
import { GapsService, GapInterval } from './gaps.service';
import { InMemoryStore } from '@/store/in-memory.store';

export interface DiscoveryRequest {
  restaurantId: string;
  sectorId: string;
  partySize: number;
  date: Date;
  durationMinutes?: number;
  notBefore?: Date;
}

export interface DiscoveryCandidate {
  tableIds: string[];
  start: Date;
  end: Date;
  capacity: {
    min: number;
    max: number;
  };
}

export interface DiscoveryResponse {
  outcome: 'success' | 'no_capacity';
  candidate?: DiscoveryCandidate;
  reason?: string;
}

/**
 * Encapsulates the WokiBrain selection logic: table combos, gap discovery,
 * and deterministic candidate ordering.
 */
@Injectable()
export class WokiBrainService {
  private readonly maxTablesPerCombo: number;
  private readonly durationsByPartySize: Record<string, number>;

  constructor(
    private readonly store: InMemoryStore,
    private readonly gapsService: GapsService,
    private readonly configService: ConfigService,
    @Inject(CAPACITY_STRATEGY_TOKEN)
    private readonly capacityStrategy: CapacityStrategy
  ) {
    this.maxTablesPerCombo =
      this.configService.get<number>('app.repack.maxTablesPerCombo') ?? 4;
    this.durationsByPartySize =
      (this.configService.get<Record<string, number>>('app.durations') as Record<
        string,
        number
      >) ?? {};
  }

  discover(request: DiscoveryRequest): DiscoveryResponse {
    const restaurant = this.store.getRestaurant(request.restaurantId);
    if (!restaurant) {
      return { outcome: 'no_capacity', reason: 'restaurant_not_found' };
    }

    const sector = this.store.getSector(request.sectorId);
    if (!sector || sector.restaurantId !== restaurant.id) {
      return { outcome: 'no_capacity', reason: 'sector_not_found' };
    }

    const tables = this.store.listTablesBySector(sector.id);
    if (!tables.length) {
      return { outcome: 'no_capacity', reason: 'no_tables_in_sector' };
    }

    const serviceWindows =
      restaurant.serviceWindows[request.date.getDay()] ?? [];
    if (!serviceWindows.length) {
      return { outcome: 'no_capacity', reason: 'closed_for_service' };
    }

    const durationMinutes =
      request.durationMinutes ??
      this.resolveDurationForPartySize(request.partySize);

    const combos = this.generateCombos(tables);
    const candidates: DiscoveryCandidate[] = [];

    for (const combo of combos) {
      const capacity = this.capacityStrategy.calculate(combo);
      if (
        request.partySize < capacity.min ||
        request.partySize > capacity.max
      ) {
        continue;
      }

      const tableIds = combo.map((table) => table.id).sort();

      for (const window of serviceWindows) {
        const gaps = this.gapsService.findAvailableSlots(
          tableIds,
          request.date,
          durationMinutes,
          window
        );
        for (const gap of gaps) {
          const candidate = this.buildCandidate(
            tableIds,
            gap,
            durationMinutes,
            capacity,
            request.notBefore
          );
          if (candidate) {
            // Each candidate represents a specific start/end pairing for this combo.
            candidates.push(candidate);
          }
        }
      }
    }

    if (!candidates.length) {
      return { outcome: 'no_capacity' };
    }

    candidates.sort((a, b) => {
      if (a.start.getTime() !== b.start.getTime()) {
        return a.start.getTime() - b.start.getTime();
      }

      const capacityDiff = a.capacity.max - b.capacity.max;
      if (capacityDiff !== 0) {
        return capacityDiff;
      }

      const comboA = a.tableIds.join(',');
      const comboB = b.tableIds.join(',');
      if (comboA < comboB) {
        return -1;
      }
      if (comboA > comboB) {
        return 1;
      }
      return 0;
    });

    return {
      outcome: 'success',
      candidate: candidates[0]
    };
  }

  markBookingConfirmed(booking: Booking): void {
    booking.status = BookingStatus.CONFIRMED;
    booking.updatedAt = new Date();
    this.store.upsertBooking(booking);
  }

  /**
   * Validates potential gaps and produces a candidate when the interval is usable.
   */
  private buildCandidate(
    tableIds: string[],
    gap: GapInterval,
    durationMinutes: number,
    capacity: { min: number; max: number },
    notBefore?: Date
  ): DiscoveryCandidate | null {
    const start =
      notBefore && notBefore.getTime() > gap.start.getTime()
        ? new Date(notBefore)
        : new Date(gap.start);
    if (start.getTime() < gap.start.getTime()) {
      return null;
    }
    if (start.getTime() >= gap.end.getTime()) {
      return null;
    }
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    if (end.getTime() > gap.end.getTime()) {
      return null;
    }
    return {
      tableIds,
      start,
      end,
      capacity
    };
  }

  /**
   * Generate all valid table combinations up to the configured max size,
   * ensuring combinability by checking each table's adjacency rules.
   */
  private generateCombos(tables: Table[]): Table[][] {
    const combos: Table[][] = [];
    const sorted = [...tables].sort((a, b) => a.id.localeCompare(b.id));

    const backtrack = (start: number, current: Table[]) => {
      if (current.length > 0) {
        combos.push([...current]);
      }
      if (current.length === this.maxTablesPerCombo) {
        return;
      }

      for (let i = start; i < sorted.length; i += 1) {
        const candidate = sorted[i];
        const combinable = current.every(
          (existing) =>
            existing.id === candidate.id ||
            (existing.combinableWith.includes(candidate.id) &&
              candidate.combinableWith.includes(existing.id))
        );
        if (!combinable) {
          continue;
        }
        current.push(candidate);
        backtrack(i + 1, current);
        current.pop();
      }
    };

    backtrack(0, []);
    return combos;
  }

  private resolveDurationForPartySize(partySize: number): number {
    if (this.durationsByPartySize[partySize]) {
      return this.durationsByPartySize[partySize];
    }
    return this.durationsByPartySize.default ?? 90;
  }
}
