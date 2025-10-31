import { forwardRef, Module } from '@nestjs/common';

import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import {
  CAPACITY_STRATEGY_TOKEN,
  ConservativeMergeStrategy,
  MaxOfMinsStrategy,
  SimpleSumStrategy,
  CapacityStrategyRouter
} from '@/domain/capacity-strategies';
import { GapsService } from '@/domain/gaps.service';
import { RepackService } from '@/domain/repack.service';
import { WokiBrainService } from '@/domain/wokibrain.service';
import { MetricsModule } from '@/metrics/metrics.module';
import { RateLimitGuard } from '@/common/guards/rate-limit.guard';
import { ApprovalGuard } from './guards/approval.guard';
import { BookingCron } from './booking.cron';
import { InMemoryStore } from '@/store/in-memory.store';
import { IdempotencyService } from '@/store/idempotency.service';
import { LockingService } from '@/store/locking.service';
import { WaitlistModule } from '@/waitlist/waitlist.module';

@Module({
  imports: [forwardRef(() => WaitlistModule), MetricsModule],
  controllers: [BookingController],
  providers: [
    BookingService,
    InMemoryStore,
    LockingService,
    IdempotencyService,
    GapsService,
    WokiBrainService,
    RepackService,
    SimpleSumStrategy,
    ConservativeMergeStrategy,
    MaxOfMinsStrategy,
    CapacityStrategyRouter,
    RateLimitGuard,
    ApprovalGuard,
    BookingCron,
    {
      provide: CAPACITY_STRATEGY_TOKEN,
      useExisting: CapacityStrategyRouter
    }
  ],
  exports: [
    BookingService,
    InMemoryStore,
    LockingService,
    IdempotencyService,
    WokiBrainService,
    GapsService,
    RepackService,
    CapacityStrategyRouter
  ]
})
export class BookingModule {}
