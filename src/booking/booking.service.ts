import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { CreateBookingDto } from './dto/create-booking.dto';
import { DiscoverBookingDto } from './dto/discover-booking.dto';
import { ListDayBookingsDto } from './dto/list-day-bookings.dto';
import { RepackDto } from './dto/repack.dto';
import { ApproveBookingDto } from './dto/approve-booking.dto';
import {
  Booking,
  BookingStatus
} from '@/domain/models';
import { WokiBrainService } from '@/domain/wokibrain.service';
import { InMemoryStore } from '@/store/in-memory.store';
import { LockingService } from '@/store/locking.service';
import { IdempotencyService } from '@/store/idempotency.service';
import { MetricsService } from '@/metrics/metrics.service';
import { WaitlistService } from '@/waitlist/waitlist.service';
import { RepackService } from '@/domain/repack.service';

export interface BookingResponse {
  id: string;
  restaurantId: string;
  sectorId: string;
  tableIds: string[];
  partySize: number;
  start: string;
  end: string;
  status: BookingStatus;
  customerName: string;
  customerContact?: string;
  notes?: string;
}

export interface DiscoveryViewCandidate {
  tableIds: string[];
  start: string;
  end: string;
  capacity: {
    min: number;
    max: number;
  };
}

export interface DiscoveryView {
  outcome: 'success' | 'no_capacity';
  candidate?: DiscoveryViewCandidate;
}

/**
 * Coordinates the full booking lifecycle: discovery, creation with locking,
 * waitlist integration, and operational utilities such as repacking.
 */
@Injectable()
export class BookingService {
  private readonly largeGroupThreshold: number;
  private readonly approvalTtlMs: number;

  constructor(
    private readonly store: InMemoryStore,
    private readonly wokiBrainService: WokiBrainService,
    private readonly lockingService: LockingService,
    private readonly idempotencyService: IdempotencyService<Booking>,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WaitlistService))
    private readonly waitlistService: WaitlistService,
    private readonly repackService: RepackService
  ) {
    this.largeGroupThreshold =
      this.configService.get<number>('app.largeGroupThreshold') ?? 8;
    this.approvalTtlMs =
      this.configService.get<number>('app.approvalTtlMs') ?? 86_400_000;
  }

  discoverAvailability(dto: DiscoverBookingDto): DiscoveryView {
    // Ask the WokiBrain domain service for a candidate, then present it as a view model.
    const date = new Date(dto.date);
    const discovery = this.wokiBrainService.discover({
      restaurantId: dto.restaurantId,
      sectorId: dto.sectorId,
      partySize: dto.partySize,
      date,
      durationMinutes: dto.durationMinutes
    });

    if (discovery.outcome !== 'success' || !discovery.candidate) {
      return { outcome: 'no_capacity' };
    }

    return {
      outcome: 'success',
      candidate: {
        tableIds: discovery.candidate.tableIds,
        start: discovery.candidate.start.toISOString(),
        end: discovery.candidate.end.toISOString(),
        capacity: discovery.candidate.capacity
      }
    };
  }

  async createBooking(
    dto: CreateBookingDto,
    idempotencyKey?: string
  ): Promise<BookingResponse> {
    if (idempotencyKey) {
      // Reuse the previous response when an idempotency key maps to an existing booking.
      const existing = this.idempotencyService.get(idempotencyKey);
      if (existing) {
        return this.toResponse(existing);
      }
    }

    const start = new Date(dto.start);
    const discovery = this.wokiBrainService.discover({
      restaurantId: dto.restaurantId,
      sectorId: dto.sectorId,
      partySize: dto.partySize,
      date: start,
      durationMinutes: dto.durationMinutes,
      notBefore: start
    });

    if (discovery.outcome !== 'success' || !discovery.candidate) {
      this.metricsService.incrementConflicts();
      throw new ConflictException('No capacity available for requested slot');
    }

    const lockKey = this.buildLockKey(
      dto.restaurantId,
      dto.sectorId,
      discovery.candidate.tableIds,
      discovery.candidate.start
    );
    const waiting = this.lockingService.getWaitingCount(lockKey);
    if (waiting > 0) {
      this.metricsService.incrementLockContention(waiting);
    }
    const release = await this.lockingService.acquire(lockKey);
    try {
      if (
        this.hasOverlap(
          discovery.candidate.tableIds,
          discovery.candidate.start,
          discovery.candidate.end
        )
      ) {
        this.metricsService.incrementConflicts();
        throw new ConflictException('Slot already taken');
      }

      const now = new Date();
      const booking: Booking = {
        id: randomUUID(),
        restaurantId: dto.restaurantId,
        sectorId: dto.sectorId,
        tableIds: discovery.candidate.tableIds,
        partySize: dto.partySize,
        start: discovery.candidate.start,
        end: discovery.candidate.end,
        status:
          dto.partySize >= this.largeGroupThreshold
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
        customerName: dto.customerName,
        customerContact: dto.customerContact,
        notes: dto.notes,
        createdAt: now,
        updatedAt: now,
        approvalExpiresAt:
          dto.partySize >= this.largeGroupThreshold
            ? new Date(now.getTime() + this.approvalTtlMs)
            : undefined,
        durationMinutes:
          dto.durationMinutes ??
          Math.round(
            (discovery.candidate.end.getTime() -
              discovery.candidate.start.getTime()) /
              60000
          ),
        idempotencyKey
      };

      this.store.upsertBooking(booking);
      this.metricsService.incrementBookingsCreated();
      if (idempotencyKey) {
        // Cache the success path for both short-lived and 24h idempotency guarantees.
        this.idempotencyService.set(idempotencyKey, booking);
      }
      return this.toResponse(booking);
    } finally {
      // Ensure we always hand the semaphore back to the pool.
      release();
    }
  }

  listDayBookings(dto: ListDayBookingsDto): BookingResponse[] {
    const date = new Date(dto.date);
    const bookings = this.store
      .listBookingsBySectorDate(dto.sectorId, date)
      .filter((booking) => {
        // By default hide cancelled records unless the client explicitly opts in.
        if (!dto.includeCancelled) {
          return booking.status !== BookingStatus.CANCELLED;
        }
        return true;
      });
    return bookings.map((booking) => this.toResponse(booking));
  }

  async cancelBooking(id: string): Promise<void> {
    const booking = this.store.getBooking(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    booking.status = BookingStatus.CANCELLED;
    booking.updatedAt = new Date();
    this.store.upsertBooking(booking);
    // Keep analytics in sync with cancellation throughput.
    this.metricsService.incrementBookingsCancelled();
    await this.waitlistService.triggerPromotion(
      booking.restaurantId,
      booking.sectorId
    );
  }

  approveBooking(id: string, dto: ApproveBookingDto): BookingResponse {
    const booking = this.store.getBooking(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    booking.status = BookingStatus.CONFIRMED;
    booking.updatedAt = new Date();
    booking.approvalExpiresAt = undefined;
    booking.notes = [booking.notes, `Approved by ${dto.approver ?? 'manager'}`]
      .filter(Boolean)
      .join(' | ');
    this.store.upsertBooking(booking);
    return this.toResponse(booking);
  }

  async repack(dto: RepackDto): Promise<number> {
    // Delegates to the optimization service (B2) to shuffle existing bookings to tighter fits.
    return this.repackService.optimize(dto.restaurantId, dto.sectorId, new Date(dto.date));
  }

  async processWaitlist(restaurantId: string, sectorId: string): Promise<void> {
    await this.waitlistService.processQueue(restaurantId, sectorId);
  }

  /**
   * Checks if any of the requested tables already host a confirmed/pending booking in the interval.
   */
  private hasOverlap(
    tableIds: string[],
    start: Date,
    end: Date
  ): boolean {
    for (const tableId of tableIds) {
      const bookings = this.store.listBookingsByTableDate(tableId, start);




































































































































































































































































































































































































































































      
      const overlapping = bookings.some((booking) => {

































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































        






















        if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
          return false;
        }
        return (
          booking.start.getTime() < end.getTime() &&
          booking.end.getTime() > start.getTime()
        );
      });
      if (overlapping) {
        return true;
      }
    }
    return false;
  }

  private buildLockKey(
    restaurantId: string,
    sectorId: string,
    tableIds: string[],
    start: Date
  ): string {
    const tablesKey = [...tableIds].sort().join('+');
    // The lock spectrum is restaurant-sector-table(s)-start; identical requests collide on purpose.
    return `${restaurantId}|${sectorId}|${tablesKey}|${start.toISOString()}`;
  }

  private toResponse(booking: Booking): BookingResponse {
    // Normalize domain entity into the API contract exposed by controller/e2e.
    return {
      id: booking.id,
      restaurantId: booking.restaurantId,
      sectorId: booking.sectorId,
      tableIds: booking.tableIds,
      partySize: booking.partySize,
      start: booking.start.toISOString(),
      end: booking.end.toISOString(),
      status: booking.status,
      customerName: booking.customerName,
      customerContact: booking.customerContact,
      notes: booking.notes
    };
  }
}
