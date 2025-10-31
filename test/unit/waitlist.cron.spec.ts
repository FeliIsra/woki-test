import { WaitlistCron } from '@/waitlist/waitlist.cron';
import { InMemoryStore } from '@/store/in-memory.store';
import { WaitlistStatus } from '@/domain/models';

describe('WaitlistCron', () => {
  it('processes sectors with waitlist entries', async () => {
    const store = new InMemoryStore();
    const waitlistService = {
      processQueue: jest.fn().mockResolvedValue(undefined)
    } as any;

    const cron = new WaitlistCron(store, waitlistService);

    const base = new Date('2025-06-01T12:00:00Z');
    store.upsertWaitlistEntry({
      id: 'entry-1',
      restaurantId: 'resto',
      sectorId: 'sector',
      partySize: 2,
      requestedAt: base,
      expiresAt: new Date(base.getTime() + 60 * 60 * 1000),
      priority: 1,
      status: WaitlistStatus.WAITING,
      customerName: 'Guest',
      createdAt: base,
      updatedAt: base
    });

    store.upsertWaitlistEntry({
      id: 'entry-2',
      restaurantId: 'resto',
      sectorId: 'sector',
      partySize: 3,
      requestedAt: base,
      expiresAt: new Date(base.getTime() + 90 * 60 * 1000),
      priority: 2,
      status: WaitlistStatus.WAITING,
      customerName: 'Guest 2',
      createdAt: base,
      updatedAt: base
    });

    await cron.handle();

    expect(waitlistService.processQueue).toHaveBeenCalledWith('resto', 'sector');
    expect(waitlistService.processQueue).toHaveBeenCalledTimes(1);
  });
});
