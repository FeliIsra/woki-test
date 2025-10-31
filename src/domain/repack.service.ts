import { Injectable } from '@nestjs/common';

import { BookingStatus, Table } from './models';
import { InMemoryStore } from '@/store/in-memory.store';

/**
 * B2 optimization: try to relocate bookings onto tighter-fitting tables to reduce wasted seats.
 */
@Injectable()
export class RepackService {
  constructor(private readonly store: InMemoryStore) {}

  optimize(restaurantId: string, sectorId: string, date: Date): number {
    const bookings = this.store
      .listBookingsBySectorDate(sectorId, date)
      .filter((booking) => booking.status === BookingStatus.CONFIRMED);
    const tables = this.store.listTablesBySector(sectorId);
    let moved = 0;

    for (const booking of bookings) {
      const currentWaste = this.computeWaste(booking.tableIds, tables, booking.partySize);
      const candidate = this.findBetterTable(
        tables,
        booking.partySize,
        booking.start,
        booking.end,
        booking.tableIds
      );

      if (!candidate) {
        continue;
      }

      const candidateWaste = candidate.maxCapacity - booking.partySize;
      if (candidateWaste < currentWaste) {
        // Reassign booking to the tighter table and persist the change.
        booking.tableIds = [candidate.id];
        booking.updatedAt = new Date();
        this.store.upsertBooking(booking);
        moved += 1;
      }
    }

    return moved;
  }

  private computeWaste(
    tableIds: string[],
    tables: Table[],
    partySize: number
  ): number {
    const relevant = tables.filter((table) => tableIds.includes(table.id));
    if (!relevant.length) {
      // No matching tables means this configuration is invalid—treat as worst possible waste.
      return Number.MAX_SAFE_INTEGER;
    }
    const capacity = relevant.reduce((sum, table) => sum + table.maxCapacity, 0);
    return capacity - partySize;
  }

  private findBetterTable(
    tables: Table[],
    partySize: number,
    start: Date,
    end: Date,
    currentTableIds: string[]
  ): Table | null {
    let best: Table | null = null;
    let bestWaste = Number.MAX_SAFE_INTEGER;

    for (const table of tables) {
      if (currentTableIds.includes(table.id)) {
        continue;
      }
      if (partySize < table.minCapacity || partySize > table.maxCapacity) {
        continue;
      }
      if (this.hasConflicts(table.id, start, end)) {
        continue;
      }
      const waste = table.maxCapacity - partySize;
      if (waste < bestWaste) {
        bestWaste = waste;
        best = table;
      }
    }

    return best;
  }

  /**
   * Avoids moving a booking onto a table that clashes with existing reservations or blackouts.
   */
  private hasConflicts(tableId: string, start: Date, end: Date): boolean {
    const bookings = this.store.listBookingsByTableDate(tableId, start);
    const bookingConflict = bookings.some((booking) => {
      if (booking.status !== BookingStatus.CONFIRMED) {
        return false;
      }
      return (
        booking.start.getTime() < end.getTime() &&
        booking.end.getTime() > start.getTime()
      );
    });
    if (bookingConflict) {
      return true;
    }

    const blackouts = this.store.listBlackoutsByTableDate(tableId, start);
    return blackouts.some(
      (blackout) =>
        blackout.start.getTime() < end.getTime() &&
        blackout.end.getTime() > start.getTime()
    );
  }
}
