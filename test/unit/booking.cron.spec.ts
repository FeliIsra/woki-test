import { BookingCron } from '@/booking/booking.cron';
import { InMemoryStore } from '@/store/in-memory.store';
import { BookingStatus } from '@/domain/models';

describe('BookingCron', () => {
  it('expires pending bookings and triggers waitlist promotions', async () => {
    const store = new InMemoryStore();
    const waitlistService = {
      triggerPromotion: jest.fn().mockResolvedValue(undefined)
    } as any;

    const cron = new BookingCron(store, waitlistService);

    const start = new Date('2025-06-01T12:00:00Z');
    store.upsertBooking({
      id: 'pending-booking',
      restaurantId: 'resto',
      sectorId: 'sector',
      tableIds: ['table'],
      partySize: 10,
      start,
      end: new Date(start.getTime() + 90 * 60 * 1000),
      status: BookingStatus.PENDING,
      customerName: 'Group',
      createdAt: start,
      updatedAt: start,
      approvalExpiresAt: new Date(Date.now() - 1000),
      durationMinutes: 90
    });

    await cron.expirePendingApprovals();

    const updated = store.getBooking('pending-booking');
    expect(updated?.status).toBe(BookingStatus.REJECTED);
    expect(waitlistService.triggerPromotion).toHaveBeenCalledWith('resto', 'sector');
  });
});
