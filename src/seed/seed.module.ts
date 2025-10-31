import { Module, forwardRef } from '@nestjs/common';

import { SeedService } from './seed.service';
import { BookingModule } from '@/booking/booking.module';

@Module({
  imports: [forwardRef(() => BookingModule)],
  providers: [SeedService],
  exports: [SeedService]
})
export class SeedModule {}
