import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InMemoryStore } from '@/store/in-memory.store';
import { BookingStatus } from '@/domain/models';
import { WaitlistService } from '@/waitlist/waitlist.service';

/**
 * Background job that periodically expires pending approvals (B3) and cascades to waitlist promotions.
 */
@Injectable()
export class BookingCron {
  constructor(
    private readonly store: InMemoryStore,
    private readonly waitlistService: WaitlistService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingApprovals(): Promise<void> {
    const now = new Date();
    const bookings = this.store.listBookings();
    for (const booking of bookings) {
      if (
        booking.status === BookingStatus.PENDING &&
        booking.approvalExpiresAt &&
        booking.approvalExpiresAt <= now
      ) {
        // Flip the booking to rejected state and wake the waitlist to reuse the slot.
        booking.status = BookingStatus.REJECTED;
        booking.updatedAt = now;
        this.store.upsertBooking(booking);
        await this.waitlistService.triggerPromotion(
          booking.restaurantId,
          booking.sectorId
        );
      }
    }
  }
}
