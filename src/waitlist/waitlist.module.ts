import { forwardRef, Module } from '@nestjs/common';

import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { WaitlistCron } from './waitlist.cron';
import { BookingModule } from '@/booking/booking.module';
import { RateLimitGuard } from '@/common/guards/rate-limit.guard';

@Module({
  imports: [forwardRef(() => BookingModule)],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistCron, RateLimitGuard],
  exports: [WaitlistService]
})
export class WaitlistModule {}
