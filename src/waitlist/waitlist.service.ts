import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';
import { ListWaitlistDto } from './dto/list-waitlist.dto';
import {
  WaitlistEntry,
  WaitlistStatus
} from '@/domain/models';
import { InMemoryStore } from '@/store/in-memory.store';
import { BookingService } from '@/booking/booking.service';

/**
 * Handles waitlist intake, TTL management, and auto-promotion into bookings when capacity frees up.
 */
@Injectable()
export class WaitlistService {
  private readonly ttlMs: number;

  constructor(
    private readonly store: InMemoryStore,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BookingService))
    private readonly bookingService: BookingService
  ) {
    this.ttlMs = this.configService.get<number>('app.waitlist.ttlMs') ?? 3_600_000;
  }

  enqueue(dto: CreateWaitlistEntryDto): WaitlistEntry {
    const now = new Date();
    const desiredTime = dto.desiredTime ? new Date(dto.desiredTime) : undefined;
    const entry: WaitlistEntry = {
      id: randomUUID(),
      restaurantId: dto.restaurantId,
      sectorId: dto.sectorId,
      partySize: dto.partySize,
      requestedAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      priority: dto.priority ?? dto.partySize,
      status: WaitlistStatus.WAITING,
      customerName: dto.customerName,
      customerContact: dto.customerContact,
      notes: dto.notes,
      desiredTime,
      createdAt: now,
      updatedAt: now
    };
    // Store sorted by sector/priority so promotion scans remain deterministic.
    this.store.upsertWaitlistEntry(entry);
    return entry;
  }

  list(dto: ListWaitlistDto): WaitlistEntry[] {
    return this.store.listWaitlistBySector(dto.sectorId);
  }

  async triggerPromotion(restaurantId: string, sectorId: string): Promise<void> {
    await this.processQueue(restaurantId, sectorId);
  }

  async processQueue(restaurantId: string, sectorId: string): Promise<void> {
    const entries = this.store.listWaitlistBySector(sectorId);
    const now = new Date();

    for (const entry of entries) {
      if (entry.restaurantId !== restaurantId) {
        continue;
      }

      if (entry.expiresAt <= now) {
        this.expireEntry(entry.id);
        continue;
      }

      try {
        await this.bookingService.createBooking(
          {
            restaurantId,
            sectorId,
            partySize: entry.partySize,
            start: (entry.desiredTime ?? now).toISOString(),
            customerName: entry.customerName,
            customerContact: entry.customerContact,
            notes: entry.notes
          },
          undefined
        );

        entry.status = WaitlistStatus.PROMOTED;
        entry.updatedAt = new Date();
        this.store.removeWaitlistEntry(entry.id);
      } catch (error) {
        if (error instanceof ConflictException) {
          // Cannot promote yet—keep the guest waiting for the next availability cycle.
          continue;
        }
        throw error;
      }
    }
  }

  expireEntry(id: string): void {
    const entry = this.store.getWaitlistEntry(id);
    if (!entry) {
      return;
    }
    entry.status = WaitlistStatus.EXPIRED;
    entry.updatedAt = new Date();
    this.store.removeWaitlistEntry(id);
  }
}
