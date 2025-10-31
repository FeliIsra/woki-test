import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InMemoryStore } from '@/store/in-memory.store';
import { WaitlistService } from './waitlist.service';

/**
 * Polls the waitlist at a fixed cadence to attempt auto-promotions across sectors (B5).
 */
@Injectable()
export class WaitlistCron {
  constructor(
    private readonly store: InMemoryStore,
    private readonly waitlistService: WaitlistService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle(): Promise<void> {
    const entries = this.store.listAllWaitlistEntries();
    const processed = new Set<string>();
    for (const entry of entries) {
      const key = `${entry.restaurantId}|${entry.sectorId}`;
      if (processed.has(key)) {
        continue;
      }
      processed.add(key);
      // Only process one entry per restaurant/sector pair per run to avoid redundant work.
      await this.waitlistService.processQueue(
        entry.restaurantId,
        entry.sectorId
      );
    }
  }
}
