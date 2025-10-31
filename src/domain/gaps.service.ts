import { Injectable } from "@nestjs/common";

import { BookingStatus, ServiceWindow } from "./models";
import { InMemoryStore } from "@/store/in-memory.store";
import type { Blackout, Booking } from "./models";

export interface GapInterval {
    start: Date;
    end: Date;
}

/**
 * Computes available gaps per table and intersects them to power the WokiBrain discovery flow.
 */
@Injectable()
export class GapsService {
    constructor(private readonly store: InMemoryStore) {}

    findAvailableSlots(
        tableIds: string[],
        date: Date,
        durationMinutes: number,
        serviceWindow: ServiceWindow
    ): GapInterval[] {
        if (!tableIds.length) {
            return [];
        }

        const targetDurationMs = durationMinutes * 60 * 1000;
        const windowStart = this.combine(date, serviceWindow.startTime);
        const windowEnd = this.combine(date, serviceWindow.endTime);

        // Build per-table gap lists so we can intersect them across combos later.
        const gapsByTable = tableIds.map((tableId) =>
            this.computeGapsForTable(tableId, date, windowStart, windowEnd)
        );

        const intersections = gapsByTable.reduce<GapInterval[]>(
            (current, gaps) => {
                if (current.length === 0) {
                    return gaps;
                }
                return this.intersectGaps(current, gaps);
            },
            []
        );

        return intersections.filter(
            (gap) => gap.end.getTime() - gap.start.getTime() >= targetDurationMs
        );
    }

    private computeGapsForTable(
        tableId: string,
        date: Date,
        windowStart: Date,
        windowEnd: Date
    ): GapInterval[] {
        const table = this.store.getTable(tableId);
        if (!table) {
            return [];
        }
        const bookings = this.store
            .listBookingsByTableDate(tableId, date)
            .filter((booking) =>
                [BookingStatus.CONFIRMED, BookingStatus.PENDING].includes(
                    booking.status
                )
            );
        // Sector-wide blackouts can target a specific table or the whole sector; dedupe via map.
        const tableBlackouts = this.store.listBlackoutsByTableDate(
            tableId,
            date
        );
        const sectorBlackouts = this.store
            .listBlackoutsBySectorDate(table.sectorId, date)
            .filter(
                (blackout) =>
                    blackout.tableId === undefined ||
                    blackout.tableId === null ||
                    blackout.tableId === tableId
            );
        const blackoutMap = new Map<string, Blackout>();
        for (const blackout of [...tableBlackouts, ...sectorBlackouts]) {
            blackoutMap.set(blackout.id, blackout);
        }
        const blackouts = [...blackoutMap.values()];

        const occupiedIntervals = this.normalizeIntervals(
            bookings,
            blackouts,
            windowStart,
            windowEnd
        );

        return this.computeGapsFromOccupied(
            occupiedIntervals,
            windowStart,
            windowEnd
        );
    }

    private normalizeIntervals(
        bookings: Booking[],
        blackouts: Blackout[],
        windowStart: Date,
        windowEnd: Date
    ): GapInterval[] {
        const intervals: GapInterval[] = [];

        for (const booking of bookings) {
            const start =
                booking.start < windowStart ? windowStart : booking.start;
            const end = booking.end > windowEnd ? windowEnd : booking.end;
            if (start < end) {
                intervals.push({ start, end });
            }
        }

        for (const blackout of blackouts) {
            const start =
                blackout.start < windowStart ? windowStart : blackout.start;
            const end = blackout.end > windowEnd ? windowEnd : blackout.end;
            if (start < end) {
                intervals.push({ start, end });
            }
        }

        intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

        const merged: GapInterval[] = [];
        for (const interval of intervals) {
            if (!merged.length) {
                merged.push(interval);
                continue;
            }

            const last = merged[merged.length - 1];
            if (interval.start.getTime() <= last.end.getTime()) {
                if (interval.end.getTime() > last.end.getTime()) {
                    last.end = interval.end;
                }
            } else {
                merged.push(interval);
            }
        }

        return merged;
    }

    private computeGapsFromOccupied(
        occupied: GapInterval[],
        windowStart: Date,
        windowEnd: Date
    ): GapInterval[] {
        const gaps: GapInterval[] = [];
        let previousEnd = windowStart;

        for (const interval of occupied) {
            if (interval.start.getTime() > previousEnd.getTime()) {
                gaps.push({
                    start: previousEnd,
                    end: interval.start,
                });
            }
            if (interval.end.getTime() > previousEnd.getTime()) {
                previousEnd = interval.end;
            }
        }

        if (previousEnd.getTime() < windowEnd.getTime()) {
            gaps.push({
                start: previousEnd,
                end: windowEnd,
            });
        }

        return gaps;
    }

    private intersectGaps(
        left: GapInterval[],
        right: GapInterval[]
    ): GapInterval[] {
        const intersections: GapInterval[] = [];

        let i = 0;
        let j = 0;

        while (i < left.length && j < right.length) {
            const a = left[i];
            const b = right[j];
            const start =
                a.start.getTime() > b.start.getTime() ? a.start : b.start;
            const end = a.end.getTime() < b.end.getTime() ? a.end : b.end;

            if (start.getTime() < end.getTime()) {
                intersections.push({ start, end });
            }

            if (a.end.getTime() < b.end.getTime()) {
                i += 1;
            } else {
                j += 1;
            }
        }

        return intersections;
    }

    private combine(date: Date, time: string): Date {










































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































        
        const [hours, minutes] = time.split(":").map(Number);
        const combined = new Date(
            Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                hours,
                minutes,
                0,
                0
            )
        );
        return combined;
    }
}
