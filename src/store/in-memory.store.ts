import { Injectable } from "@nestjs/common";

import {
    Blackout,
    Booking,
    Restaurant,
    Sector,
    Table,
    WaitlistEntry,
} from "@/domain/models";

const dateKey = (date: Date): string =>
    date.toISOString().split("T")[0] ?? date.toISOString();

const sectorDateKey = (sectorId: string, date: Date): string =>
    `${sectorId}|${dateKey(date)}`;

const tableDateKey = (tableId: string, date: Date): string =>
    `${tableId}|${dateKey(date)}`;

/**
 * Simple in-memory data store with manual secondary indexes used across services/tests.
 */
@Injectable()
export class InMemoryStore {
    private readonly restaurants = new Map<string, Restaurant>();
    private readonly sectors = new Map<string, Sector>();
    private readonly tables = new Map<string, Table>();
    private readonly bookings = new Map<string, Booking>();
    private readonly blackouts = new Map<string, Blackout>();
    private readonly waitlistEntries = new Map<string, WaitlistEntry>();

    private readonly bookingsBySectorDate = new Map<string, Set<string>>();
    private readonly bookingsByTableDate = new Map<string, Set<string>>();

    private readonly blackoutsBySectorDate = new Map<string, Set<string>>();
    private readonly blackoutsByTableDate = new Map<string, Set<string>>();

    private readonly waitlistBySector = new Map<string, Set<string>>();

    upsertRestaurant(restaurant: Restaurant): void {
        this.restaurants.set(restaurant.id, restaurant);
    }

    getRestaurant(id: string): Restaurant | undefined {
        return this.restaurants.get(id);
    }

    listRestaurants(): Restaurant[] {
        return [...this.restaurants.values()];
    }

    upsertSector(sector: Sector): void {
        this.sectors.set(sector.id, sector);
    }

    getSector(id: string): Sector | undefined {
        return this.sectors.get(id);
    }

    listSectors(): Sector[] {
        return [...this.sectors.values()];
    }

    listSectorsByRestaurant(restaurantId: string): Sector[] {
        return [...this.sectors.values()].filter(
            (sector) => sector.restaurantId === restaurantId
        );
    }

    upsertTable(table: Table): void {
        this.tables.set(table.id, table);
    }

    getTable(id: string): Table | undefined {
        return this.tables.get(id);
    }

    listTables(): Table[] {
        return [...this.tables.values()];
    }

    listTablesBySector(sectorId: string): Table[] {
        return [...this.tables.values()].filter(
            (table) => table.sectorId === sectorId
        );
    }

    listTablesByIds(tableIds: string[]): Table[] {
        return tableIds
            .map((tableId) => this.tables.get(tableId))
            .filter((table): table is Table => Boolean(table));
    }

    upsertBooking(booking: Booking): void {
        this.bookings.set(booking.id, booking);
        // Maintain forward indexes so lookups by sector/table stay O(1) -> O(n).
        this.indexBooking(booking);
    }

    getBooking(bookingId: string): Booking | undefined {
        return this.bookings.get(bookingId);
    }

    listBookings(): Booking[] {
        return [...this.bookings.values()];
    }

    listBookingsBySectorDate(sectorId: string, date: Date): Booking[] {
        const key = sectorDateKey(sectorId, date);
        const ids = this.bookingsBySectorDate.get(key);
        if (!ids?.size) {
            return [];
        }
        return [...ids]
            .map((id) => this.bookings.get(id))
            .filter((booking): booking is Booking => Boolean(booking))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    listBookingsByTableDate(tableId: string, date: Date): Booking[] {
        const key = tableDateKey(tableId, date);
        const ids = this.bookingsByTableDate.get(key);
        if (!ids?.size) {
            return [];
        }
        return [...ids]
            .map((id) => this.bookings.get(id))
            .filter((booking): booking is Booking => Boolean(booking))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    removeBooking(bookingId: string): Booking | undefined {
        const booking = this.bookings.get(bookingId);
        if (!booking) {
            return undefined;
        }
        this.bookings.delete(bookingId);
        // Keep indexes in sync with the base map.
        this.unindexBooking(booking);
        return booking;
    }

    upsertBlackout(blackout: Blackout): void {
        this.blackouts.set(blackout.id, blackout);
        // Blackouts feed gap discovery, so indexing by sector/table is also required.
        this.indexBlackout(blackout);
    }

    listBlackoutsBySectorDate(sectorId: string, date: Date): Blackout[] {
        const key = sectorDateKey(sectorId, date);
        return this.lookupBlackouts(key);
    }

    listBlackoutsByTableDate(tableId: string, date: Date): Blackout[] {
        const key = tableDateKey(tableId, date);
        return this.lookupBlackouts(key);
    }

    removeBlackout(blackoutId: string): Blackout | undefined {
        const blackout = this.blackouts.get(blackoutId);
        if (!blackout) {
            return undefined;
        }
        this.blackouts.delete(blackoutId);
        this.unindexBlackout(blackout);
        return blackout;
    }

    upsertWaitlistEntry(entry: WaitlistEntry): void {
        this.waitlistEntries.set(entry.id, entry);
        const key = entry.sectorId;
        const existing = this.waitlistBySector.get(key) ?? new Set<string>();
        existing.add(entry.id);
        this.waitlistBySector.set(key, existing);
    }

    listWaitlistBySector(sectorId: string): WaitlistEntry[] {
        const ids = this.waitlistBySector.get(sectorId);
        if (!ids?.size) {
            return [];
        }
        return [...ids]
            .map((id) => this.waitlistEntries.get(id))
            .filter((entry): entry is WaitlistEntry => Boolean(entry))
            .sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority;
                }
                return a.requestedAt.getTime() - b.requestedAt.getTime();
            });
    }

    getWaitlistEntry(id: string): WaitlistEntry | undefined {
        return this.waitlistEntries.get(id);
    }

    listAllWaitlistEntries(): WaitlistEntry[] {
        return [...this.waitlistEntries.values()];
    }

    removeWaitlistEntry(id: string): WaitlistEntry | undefined {
        const entry = this.waitlistEntries.get(id);
        if (!entry) {
            return undefined;
        }
        this.waitlistEntries.delete(id);
        const entries = this.waitlistBySector.get(entry.sectorId);
        entries?.delete(id);
        return entry;
    }

    clear(): void {
        // Utility for tests/seed resets—wipe every map/index.
        this.restaurants.clear();
        this.sectors.clear();
        this.tables.clear();
        this.bookings.clear();
        this.blackouts.clear();
        this.waitlistEntries.clear();
        this.bookingsBySectorDate.clear();
        this.bookingsByTableDate.clear();
        this.blackoutsBySectorDate.clear();
        this.blackoutsByTableDate.clear();
        this.waitlistBySector.clear();
    }

    // Maintain secondary indexes for quick lookups by sector/table and day.
    private indexBooking(booking: Booking): void {
        const sectorKey = sectorDateKey(booking.sectorId, booking.start);
        const sectorSet =
            this.bookingsBySectorDate.get(sectorKey) ?? new Set<string>();
        sectorSet.add(booking.id);
        this.bookingsBySectorDate.set(sectorKey, sectorSet);

        for (const tableId of booking.tableIds) {
            const key = tableDateKey(tableId, booking.start);
            const tableSet =
                this.bookingsByTableDate.get(key) ?? new Set<string>();
            tableSet.add(booking.id);
            this.bookingsByTableDate.set(key, tableSet);
        }
    }

    private unindexBooking(booking: Booking): void {
        const sectorKey = sectorDateKey(booking.sectorId, booking.start);
        this.bookingsBySectorDate.get(sectorKey)?.delete(booking.id);
        for (const tableId of booking.tableIds) {
            const key = tableDateKey(tableId, booking.start);
            this.bookingsByTableDate.get(key)?.delete(booking.id);
        }
    }

    private indexBlackout(blackout: Blackout): void {
        if (blackout.sectorId) {
            const key = sectorDateKey(blackout.sectorId, blackout.start);
            const set =
                this.blackoutsBySectorDate.get(key) ?? new Set<string>();
            set.add(blackout.id);
            this.blackoutsBySectorDate.set(key, set);
        }
        if (blackout.tableId) {
            const key = tableDateKey(blackout.tableId, blackout.start);
            const set = this.blackoutsByTableDate.get(key) ?? new Set<string>();
            set.add(blackout.id);
            this.blackoutsByTableDate.set(key, set);
        }
    }

    private unindexBlackout(blackout: Blackout): void {
        if (blackout.sectorId) {
            const key = sectorDateKey(blackout.sectorId, blackout.start);
            this.blackoutsBySectorDate.get(key)?.delete(blackout.id);
        }
        if (blackout.tableId) {
            const key = tableDateKey(blackout.tableId, blackout.start);
            this.blackoutsByTableDate.get(key)?.delete(blackout.id);
        }
    }

    private lookupBlackouts(key: string): Blackout[] {
        const ids =
            this.blackoutsBySectorDate.get(key) ??
            this.blackoutsByTableDate.get(key);
        if (!ids?.size) {
            return [];
        }
        return [...ids]
            .map((id) => this.blackouts.get(id))
            .filter((blackout): blackout is Blackout => Boolean(blackout))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }
}
